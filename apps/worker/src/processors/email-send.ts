import type { EmailSendData } from "@axon/shared/queues";
import type { Job } from "bullmq";
import { logger } from "../lib/logger";

export async function emailSendProcessor(job: Job<EmailSendData>) {
  const { _meta, to, subject, template } = job.data;
  logger.info({ jobId: _meta.jobId, to, subject, template }, "email.send stub");
  return { stub: true, delivered: false };
}
