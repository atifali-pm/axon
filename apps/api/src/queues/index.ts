import { db, schema } from "@axon/db";
import {
  type AgentRunData,
  type EmailSendData,
  type EmbeddingGenerateData,
  type JobDataMap,
  type QueueName,
  QUEUE_NAMES,
  type RagIngestData,
  type ScrapeUrlData,
  type StripeWebhookData,
  type WebhookSendData,
} from "@axon/shared/queues";
import { Queue } from "bullmq";
import { redisConnection } from "./connection";

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 86400 },
};

export const queues = {
  [QUEUE_NAMES.agentRun]: new Queue<AgentRunData>(QUEUE_NAMES.agentRun, {
    connection: redisConnection,
    defaultJobOptions,
  }),
  [QUEUE_NAMES.ragIngest]: new Queue<RagIngestData>(QUEUE_NAMES.ragIngest, {
    connection: redisConnection,
    defaultJobOptions,
  }),
  [QUEUE_NAMES.emailSend]: new Queue<EmailSendData>(QUEUE_NAMES.emailSend, {
    connection: redisConnection,
    defaultJobOptions,
  }),
  [QUEUE_NAMES.webhookSend]: new Queue<WebhookSendData>(QUEUE_NAMES.webhookSend, {
    connection: redisConnection,
    defaultJobOptions,
  }),
  [QUEUE_NAMES.scrapeUrl]: new Queue<ScrapeUrlData>(QUEUE_NAMES.scrapeUrl, {
    connection: redisConnection,
    defaultJobOptions,
  }),
  [QUEUE_NAMES.embeddingGenerate]: new Queue<EmbeddingGenerateData>(QUEUE_NAMES.embeddingGenerate, {
    connection: redisConnection,
    defaultJobOptions,
  }),
  [QUEUE_NAMES.stripeWebhook]: new Queue<StripeWebhookData>(QUEUE_NAMES.stripeWebhook, {
    connection: redisConnection,
    defaultJobOptions,
  }),
} satisfies Record<QueueName, Queue>;

type BareData<Q extends QueueName> = Omit<JobDataMap[Q], "_meta">;

/**
 * Insert a row in the `jobs` table and enqueue a BullMQ job carrying
 * `{ ...data, _meta: { orgId, jobId, enqueuedAt } }`. The worker updates the
 * jobs row through its lifecycle. Callers reference the returned jobId when
 * polling status.
 */
export async function enqueue<Q extends QueueName>(
  queueName: Q,
  jobName: string,
  data: BareData<Q>,
  orgId: string,
) {
  const rows = await db
    .insert(schema.jobs)
    .values({ organizationId: orgId, type: queueName, input: data as object })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("failed to insert jobs row");

  const queue = queues[queueName] as unknown as Queue;
  await queue.add(jobName, {
    ...data,
    _meta: { orgId, jobId: row.id, enqueuedAt: Date.now() },
  });

  return row;
}
