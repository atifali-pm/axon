/**
 * Message feedback + fine-tune export.
 *
 *   POST /api/chat/messages/:id/feedback   body { rating: -1 | 1, reason? }
 *   GET  /api/chat/feedback                 list recent with message context
 *   GET  /api/chat/feedback/export           JSONL of (prompt, completion, rating)
 *                                           pairs for LoRA / few-shot training
 *
 * The export builds tuples by pairing each rated assistant message with
 * the immediately preceding user message in the same conversation. Org
 * scoped throughout; withOrg + RLS enforce it at the DB.
 */
import { db, schema } from "@axon/db";
import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth";

type FeedbackBody = { rating?: number; reason?: string };

export async function feedbackRoutes(app: FastifyInstance) {
  // Submit or update feedback for an assistant message.
  app.post<{ Params: { id: string }; Body: FeedbackBody }>(
    "/messages/:id/feedback",
    { preHandler: requireAuth },
    async (req, reply) => {
      const b = req.body ?? {};
      if (b.rating !== 1 && b.rating !== -1) {
        return reply.code(400).send({ error: "rating_must_be_plus_or_minus_one" });
      }
      if (b.reason && b.reason.length > 2_000) {
        return reply.code(400).send({ error: "reason_too_long" });
      }

      // Verify the message belongs to the caller's org via conversation FK.
      // Uses the superuser connection to look across conversations -> messages;
      // the org_id filter on conversations keeps it tenant-safe.
      const msg = await db
        .select({
          messageId: schema.messages.id,
          role: schema.messages.role,
          organizationId: schema.conversations.organizationId,
        })
        .from(schema.messages)
        .innerJoin(
          schema.conversations,
          eq(schema.conversations.id, schema.messages.conversationId),
        )
        .where(
          and(
            eq(schema.messages.id, req.params.id),
            eq(schema.conversations.organizationId, req.organization.id),
          ),
        )
        .limit(1);

      const row = msg[0];
      if (!row) return reply.code(404).send({ error: "message_not_found" });
      if (row.role !== "assistant") {
        return reply.code(400).send({ error: "only_assistant_messages_can_be_rated" });
      }

      // Upsert by (user, message): users can change their mind.
      const existing = await db.query.messageFeedback.findFirst({
        where: and(
          eq(schema.messageFeedback.userId, req.user.id),
          eq(schema.messageFeedback.messageId, req.params.id),
        ),
      });
      if (existing) {
        await db
          .update(schema.messageFeedback)
          .set({ rating: b.rating, reason: b.reason ?? null })
          .where(eq(schema.messageFeedback.id, existing.id));
      } else {
        await db.insert(schema.messageFeedback).values({
          messageId: req.params.id,
          organizationId: req.organization.id,
          userId: req.user.id,
          rating: b.rating,
          reason: b.reason ?? null,
        });
      }
      return { ok: true, rating: b.rating };
    },
  );

  // Delete feedback (undo thumb).
  app.delete<{ Params: { id: string } }>(
    "/messages/:id/feedback",
    { preHandler: requireAuth },
    async (req, _reply) => {
      await db
        .delete(schema.messageFeedback)
        .where(
          and(
            eq(schema.messageFeedback.userId, req.user.id),
            eq(schema.messageFeedback.messageId, req.params.id),
          ),
        );
      return { ok: true };
    },
  );

  // Recent feedback list (for display/admin purposes).
  app.get<{ Querystring: { limit?: string } }>(
    "/feedback",
    { preHandler: requireAuth },
    async (req) => {
      const limit = Math.min(200, Math.max(1, Number(req.query?.limit ?? 50) || 50));
      const rows = await db
        .select({
          id: schema.messageFeedback.id,
          rating: schema.messageFeedback.rating,
          reason: schema.messageFeedback.reason,
          createdAt: schema.messageFeedback.createdAt,
          messageId: schema.messageFeedback.messageId,
          messagePreview: sql<string>`left(${schema.messages.content}, 240)`,
        })
        .from(schema.messageFeedback)
        .innerJoin(schema.messages, eq(schema.messages.id, schema.messageFeedback.messageId))
        .where(eq(schema.messageFeedback.organizationId, req.organization.id))
        .orderBy(desc(schema.messageFeedback.createdAt))
        .limit(limit);
      return { feedback: rows };
    },
  );

  // JSONL export: one {prompt, completion, rating, reason} object per line.
  // The export walks each rated assistant message and looks up the
  // immediately preceding user message as the prompt. Deliberately simple;
  // a training pipeline can re-expand with system prompts, tool calls, etc.
  app.get(
    "/feedback/export",
    { preHandler: requireAuth },
    async (req, reply) => {
      const rows = await db
        .select({
          feedbackId: schema.messageFeedback.id,
          rating: schema.messageFeedback.rating,
          reason: schema.messageFeedback.reason,
          createdAt: schema.messageFeedback.createdAt,
          assistantContent: schema.messages.content,
          conversationId: schema.messages.conversationId,
          assistantCreatedAt: schema.messages.createdAt,
          assistantMessageId: schema.messages.id,
        })
        .from(schema.messageFeedback)
        .innerJoin(schema.messages, eq(schema.messages.id, schema.messageFeedback.messageId))
        .where(eq(schema.messageFeedback.organizationId, req.organization.id))
        .orderBy(asc(schema.messageFeedback.createdAt));

      // For each rated assistant message, find the most recent user message
      // earlier in the same conversation.
      const lines: string[] = [];
      for (const r of rows) {
        const priorUser = await db
          .select({ content: schema.messages.content })
          .from(schema.messages)
          .where(
            and(
              eq(schema.messages.conversationId, r.conversationId),
              eq(schema.messages.role, "user"),
              lt(schema.messages.createdAt, r.assistantCreatedAt),
            ),
          )
          .orderBy(desc(schema.messages.createdAt))
          .limit(1);
        const prompt = priorUser[0]?.content ?? "";
        if (!prompt || !r.assistantContent) continue;
        lines.push(
          JSON.stringify({
            prompt,
            completion: r.assistantContent,
            rating: r.rating,
            reason: r.reason ?? null,
            messageId: r.assistantMessageId,
            createdAt: r.createdAt,
          }),
        );
      }
      reply.header("Content-Type", "application/x-ndjson");
      reply.header(
        "Content-Disposition",
        `attachment; filename="axon-feedback-${req.organization.slug}.jsonl"`,
      );
      return lines.join("\n") + (lines.length ? "\n" : "");
    },
  );
}
