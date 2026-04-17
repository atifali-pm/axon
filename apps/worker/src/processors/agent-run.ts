import type { AgentRunData } from "@axon/shared/queues";
import type { Job } from "bullmq";
import { logger } from "../lib/logger";

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

  return {
    content: body.content,
    messageCount: body.messages?.length ?? 0,
    latencyMs,
  };
}
