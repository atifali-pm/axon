import { schema, withOrg } from "@axon/db";
import type { RagIngestData } from "@axon/shared/queues";
import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { chunkText, estimateTokens } from "../lib/chunker";
import { generateEmbeddings } from "../lib/embeddings";
import { type SourceType, extractText } from "../lib/extractors";
import { logger } from "../lib/logger";
import { downloadObject } from "../lib/storage";

export async function ragIngestProcessor(job: Job<RagIngestData>) {
  const { _meta, documentId, source, sourceType } = job.data;
  const t0 = Date.now();

  // 1) Pull the raw bytes (or raw text) from storage.
  //    `source` is either an S3/MinIO key (for uploaded files) or a literal URL.
  let payload: Buffer | string;
  if (sourceType === "url") {
    payload = source; // extractor fetches it
  } else if (sourceType === "txt" || sourceType === "html") {
    const bytes = await downloadObject(source);
    payload = bytes.toString("utf8");
  } else {
    payload = await downloadObject(source);
  }

  // 2) Extract plain text.
  const raw = await extractText(payload, sourceType as SourceType);
  if (!raw.trim()) {
    logger.warn({ jobId: _meta.jobId, documentId }, "empty extracted text; nothing to index");
    return { chunks: 0, tokensEstimated: 0, latencyMs: Date.now() - t0 };
  }

  // 3) Chunk.
  const chunks = chunkText(raw, { size: 500, overlap: 50 });
  if (!chunks.length) {
    return { chunks: 0, tokensEstimated: 0, latencyMs: Date.now() - t0 };
  }

  // 4) Embed.
  const embeddings = await generateEmbeddings(chunks, { concurrency: 4 });

  // 5) Bulk insert inside withOrg so RLS applies + the connection is the
  //    axon_app role. Drop any existing chunks for this document first so
  //    re-ingest is idempotent.
  await withOrg(_meta.orgId, async (tx) => {
    await tx.delete(schema.chunks).where(eq(schema.chunks.documentId, documentId));
    await tx.insert(schema.chunks).values(
      chunks.map((content, i) => ({
        documentId,
        organizationId: _meta.orgId,
        content,
        embedding: embeddings[i],
        tokenCount: estimateTokens(content),
      })),
    );
  });

  const latencyMs = Date.now() - t0;
  const tokensEstimated = chunks.reduce((n, c) => n + estimateTokens(c), 0);
  logger.info(
    { jobId: _meta.jobId, documentId, chunks: chunks.length, tokensEstimated, latencyMs },
    "rag.ingest completed",
  );
  return { chunks: chunks.length, tokensEstimated, latencyMs };
}
