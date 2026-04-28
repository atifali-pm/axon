import { db, schema, withOrg } from "@axon/db";
import type { AgentRunData } from "@axon/shared/queues";
import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { pushToUser } from "../lib/push";

const AGENT_URL = process.env.AGENT_SERVICE_URL ?? "http://localhost:8100";
const AGENT_KEY = process.env.AGENT_API_KEY;

export async function agentRunProcessor(job: Job<AgentRunData>) {
  const { _meta, agentId, templateId, message, conversationId } = job.data;

  if (!AGENT_KEY) {
    throw new Error("AGENT_API_KEY not set; cannot call agents service");
  }

  const startedAt = Date.now();
  const res = await fetch(`${AGENT_URL}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AGENT_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agentId,
      templateId,
      message,
      conversationId,
      orgId: _meta.orgId,
    }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`agent service ${res.status}: ${text.slice(0, 500)}`);
  }

  const body = (await res.json()) as { content: string; messages: unknown[] };
  const latencyMs = Date.now() - startedAt;

  // Persist the assistant reply so the conversation /messages endpoint stays
  // in sync. The streaming path on the API does this in its finally block;
  // the async (queued) path was missing it, leaving conversations with only
  // the user message.
  let assistantMessageId: string | null = null;
  if (conversationId && body.content) {
    try {
      const rows = await withOrg(_meta.orgId, (tx) =>
        tx
          .insert(schema.messages)
          .values({
            conversationId,
            role: "assistant",
            content: body.content,
          })
          .returning({ id: schema.messages.id }),
      );
      assistantMessageId = rows[0]?.id ?? null;
    } catch (err) {
      logger.warn({ err, conversationId }, "failed to persist assistant message");
    }
  }

  logger.info(
    {
      jobId: _meta.jobId,
      orgId: _meta.orgId,
      agentId,
      messageCount: body.messages?.length ?? 0,
      latencyMs,
    },
    "agent.run completed",
  );

  // Push the user (all registered devices) so mobile gets a notification
  // even when the app is backgrounded. Only fires for async runs (which
  // carry conversationId so we can look up the owner). Runs > 5s benefit
  // most; short conversational turns are already streamed directly.
  if (latencyMs > 3_000 && conversationId) {
    try {
      const conv = await db.query.conversations.findFirst({
        where: eq(schema.conversations.id, conversationId),
        columns: { userId: true, title: true },
      });
      if (conv?.userId) {
        const preview = (body.content ?? "").slice(0, 120);
        await pushToUser(conv.userId, {
          title: conv.title ?? "Axon reply",
          body: preview,
          data: { conversationId, jobId: _meta.jobId },
        });
      }
    } catch (err) {
      logger.warn({ err }, "push notification failed (non-fatal)");
    }
  }

  return {
    content: body.content,
    messageCount: body.messages?.length ?? 0,
    latencyMs,
    assistantMessageId,
  };
}
