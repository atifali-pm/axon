import type { StripeWebhookData } from "@axon/shared/queues";
import type { Job } from "bullmq";
import { logger } from "../lib/logger";

export async function stripeWebhookProcessor(job: Job<StripeWebhookData>) {
  const { _meta } = job.data;
  logger.info({ jobId: _meta.jobId }, "stripe.webhook stub");
  return { stub: true };
}
