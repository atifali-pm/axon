import path from "node:path";
import { fileURLToPath } from "node:url";
import { QUEUE_NAMES } from "@axon/shared/queues";
import { type Job, type Processor, Worker } from "bullmq";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenvExpand.expand(dotenv.config({ path: path.resolve(here, "../../../.env") }));

const { redisConnection } = await import("./lib/connection");
const { logger } = await import("./lib/logger");
const { markCompleted, markFailed, markRunning } = await import("./lib/jobs");

const { agentRunProcessor } = await import("./processors/agent-run");
const { ragIngestProcessor } = await import("./processors/rag-ingest");
const { emailSendProcessor } = await import("./processors/email-send");
const { webhookSendProcessor } = await import("./processors/webhook-send");
const { scrapeUrlProcessor } = await import("./processors/scrape-url");
const { embeddingGenerateProcessor } = await import("./processors/embedding-generate");
const { stripeWebhookProcessor } = await import("./processors/stripe-webhook");

/**
 * Wrap a processor so jobs-table status transitions happen on every run.
 * markRunning before, markCompleted with the return value after success,
 * markFailed on throw; the error then propagates so BullMQ retries per its
 * backoff policy.
 */
function wrap<T extends { _meta: { jobId: string; orgId: string } }>(
  name: string,
  fn: Processor<T>,
): Processor<T> {
  return async (job: Job<T>, token?: string) => {
    const meta = job.data._meta;
    await markRunning(meta);
    try {
      const result = await fn(job, token);
      await markCompleted(meta, result);
      logger.info(
        { queue: name, jobId: meta.jobId, bullmqId: job.id },
        "job completed",
      );
      return result;
    } catch (err) {
      await markFailed(meta, err);
      logger.error({ queue: name, jobId: meta.jobId, err }, "job failed");
      throw err;
    }
  };
}

const workerDefs = [
  { name: QUEUE_NAMES.agentRun, fn: agentRunProcessor, concurrency: 5 },
  { name: QUEUE_NAMES.ragIngest, fn: ragIngestProcessor, concurrency: 3 },
  { name: QUEUE_NAMES.emailSend, fn: emailSendProcessor, concurrency: 10 },
  { name: QUEUE_NAMES.webhookSend, fn: webhookSendProcessor, concurrency: 5 },
  { name: QUEUE_NAMES.scrapeUrl, fn: scrapeUrlProcessor, concurrency: 2 },
  { name: QUEUE_NAMES.embeddingGenerate, fn: embeddingGenerateProcessor, concurrency: 4 },
  { name: QUEUE_NAMES.stripeWebhook, fn: stripeWebhookProcessor, concurrency: 10 },
] as const;

const workers = workerDefs.map(
  (d) =>
    new Worker(d.name, wrap(d.name, d.fn as Processor), {
      connection: redisConnection,
      concurrency: d.concurrency,
    }),
);

for (const w of workers) {
  w.on("error", (err) => logger.error({ queue: w.name, err }, "worker error"));
}

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down workers");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

logger.info(
  { queues: workers.map((w) => w.name) },
  `${workers.length} workers ready`,
);
