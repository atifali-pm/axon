import type { WebhookSendData } from "@axon/shared/queues";
import type { Job } from "bullmq";
import { logger } from "../lib/logger";

export async function webhookSendProcessor(job: Job<WebhookSendData>) {
  const { _meta, url, event } = job.data;
  logger.info({ jobId: _meta.jobId, url, event }, "webhook.send stub");
  return { stub: true };
}
