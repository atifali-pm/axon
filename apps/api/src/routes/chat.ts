import { schema, withOrg } from "@axon/db";
import { QUEUE_NAMES } from "@axon/shared/queues";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth";
import { enqueue } from "../queues";

type ChatBody = {
  message?: string;
  conversationId?: string;
  agentId?: string;
  stream?: boolean;
};

const AGENT_URL = process.env.AGENT_SERVICE_URL ?? "http://localhost:8100";
const AGENT_KEY = process.env.AGENT_API_KEY;

export async function chatRoutes(app: FastifyInstance) {
  app.post<{ Body: ChatBody }>("/", { preHandler: requireAuth }, async (req, reply) => {
    if (!AGENT_KEY) return reply.code(500).send({ error: "agent_service_misconfigured" });
    const body = req.body ?? {};
    if (!body.message) return reply.code(400).send({ error: "message_required" });

    const orgId = req.organization.id;
    const userId = req.user.id;
    const agentId = body.agentId ?? "default";
    const shouldStream = body.stream !== false;

    // Upsert conversation + persist the user message inside a single
    // RLS-scoped transaction before calling out to the agent service.
    const conv = await withOrg(orgId, async (tx) => {
      let c: typeof schema.conversations.$inferSelect | undefined;
      if (body.conversationId) {
        c = await tx.query.conversations.findFirst({
          where: and(
            eq(schema.conversations.id, body.conversationId),
            eq(schema.conversations.organizationId, orgId),
          ),
        });
      }
      if (!c) {
        const [row] = await tx
          .insert(schema.conversations)
          .values({
            organizationId: orgId,
            userId,
            title: body.message!.slice(0, 80),
          })
          .returning();
        c = row;
      }
      await tx.insert(schema.messages).values({
        conversationId: c.id,
        role: "user",
        content: body.message!,
      });
      return c;
    });

    if (shouldStream) {
      const upstream = await fetch(`${AGENT_URL}/stream`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AGENT_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId,
          message: body.message,
          conversationId: conv.id,
          orgId,
        }),
      });

      if (!upstream.ok || !upstream.body) {
        const text = await upstream.text().catch(() => "");
        return reply
          .code(502)
          .send({ error: "agent_stream_failed", status: upstream.status, detail: text });
      }

      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Conversation-Id", conv.id);
      reply.hijack();

      const decoder = new TextDecoder();
      let buffered = "";
      let finalText = "";
      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          reply.raw.write(chunk);
          buffered += chunk;
          // Parse "data: {...}" frames to accumulate the final assistant text
          // so we can persist the message at the end of the stream.
          let idx: number;
          while ((idx = buffered.indexOf("\n\n")) !== -1) {
            const frame = buffered.slice(0, idx).trim();
            buffered = buffered.slice(idx + 2);
            if (!frame.startsWith("data:")) continue;
            const payload = frame.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const ev = JSON.parse(payload) as { type: string; content?: string };
              if (ev.type === "token" && typeof ev.content === "string") {
                finalText += ev.content;
              }
            } catch {
              // ignore non-JSON frames
            }
          }
        }
      } finally {
        reply.raw.end();
      }

      // Persist assistant message after stream completes.
      if (finalText) {
        await withOrg(orgId, (tx) =>
          tx.insert(schema.messages).values({
            conversationId: conv.id,
            role: "assistant",
            content: finalText,
          }),
        );
      }
      return;
    }

    // Async mode: enqueue a job, client polls /api/jobs/:id
    const row = await enqueue(
      QUEUE_NAMES.agentRun,
      "run",
      { agentId, message: body.message!, conversationId: conv.id },
      orgId,
    );
    return { jobId: row.id, conversationId: conv.id, status: row.status };
  });

  app.get("/", { preHandler: requireAuth }, async (req) => {
    const rows = await withOrg(req.organization.id, (tx) =>
      tx.query.conversations.findMany({
        orderBy: [desc(schema.conversations.updatedAt)],
        limit: 20,
      }),
    );
    return { conversations: rows };
  });

  app.get<{ Params: { id: string } }>(
    "/:id/messages",
    { preHandler: requireAuth },
    async (req, reply) => {
      const rows = await withOrg(req.organization.id, async (tx) => {
        const conv = await tx.query.conversations.findFirst({
          where: and(
            eq(schema.conversations.id, req.params.id),
            eq(schema.conversations.organizationId, req.organization.id),
          ),
        });
        if (!conv) return null;
        return tx.query.messages.findMany({
          where: eq(schema.messages.conversationId, conv.id),
          orderBy: [schema.messages.createdAt],
        });
      });
      if (rows === null) return reply.code(404).send({ error: "not_found" });
      return { messages: rows };
    },
  );
}
