import { db, schema } from "@axon/db";
import type { AgentRunData } from "@axon/shared/queues";
import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { pushToUser } from "../lib/push";

const AGENT_URL = process.env.AGENT_SERVICE_URL ?? "http://localhost:8100";
const AGENT_KEY = process.env.AGENT_API_KEY;

export async function agentRunProcessor(job: Job<AgentRunData>) {
  const { _meta, agentId, message, conversationId } = job.data;

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
  };
}
