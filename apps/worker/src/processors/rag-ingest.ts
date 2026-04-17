import type { RagIngestData } from "@axon/shared/queues";
import type { Job } from "bullmq";
import { logger } from "../lib/logger";

export async function ragIngestProcessor(job: Job<RagIngestData>) {
  const { _meta, documentId, sourceType } = job.data;
  logger.info({ jobId: _meta.jobId, documentId, sourceType }, "rag.ingest stub");
  // Real implementation lands in Phase 5 (extract, chunk, embed).
  return { stub: true, chunks: 0 };
}
