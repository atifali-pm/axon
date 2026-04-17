import type { EmbeddingGenerateData } from "@axon/shared/queues";
import type { Job } from "bullmq";
import { logger } from "../lib/logger";

export async function embeddingGenerateProcessor(job: Job<EmbeddingGenerateData>) {
  const { _meta, chunkIds } = job.data;
  logger.info({ jobId: _meta.jobId, count: chunkIds.length }, "embedding.generate stub");
  return { stub: true };
}
