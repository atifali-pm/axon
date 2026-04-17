import type { AgentRunData } from "@axon/shared/queues";
import type { Job } from "bullmq";
import { logger } from "../lib/logger";

export async function agentRunProcessor(job: Job<AgentRunData>) {
  const { _meta, agentId, message } = job.data;
  logger.info({ jobId: _meta.jobId, orgId: _meta.orgId, agentId }, "agent.run stub");
  // Real implementation lands in Phase 4 (calls Python agents service).
  return { stub: true, agentId, echo: message };
}
