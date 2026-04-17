export const QUEUE_NAMES = {
  agentRun: "agent.run",
  ragIngest: "rag.ingest",
  emailSend: "email.send",
  webhookSend: "webhook.send",
  scrapeUrl: "scrape.url",
  embeddingGenerate: "embedding.generate",
  stripeWebhook: "stripe.webhook",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const ALL_QUEUE_NAMES: QueueName[] = Object.values(QUEUE_NAMES);

export type JobMeta = {
  orgId: string;
  jobId: string;
  enqueuedAt: number;
};

export type WithMeta<T> = T & { _meta: JobMeta };

export type AgentRunData = WithMeta<{
  agentId: string;
  message: string;
  conversationId: string | null;
}>;

export type RagIngestData = WithMeta<{
  documentId: string;
  source: string;
  sourceType: "pdf" | "docx" | "txt" | "html" | "url";
}>;

export type EmailSendData = WithMeta<{
  to: string;
  subject: string;
  template: string;
  variables?: Record<string, unknown>;
}>;

export type WebhookSendData = WithMeta<{
  url: string;
  event: string;
  payload: unknown;
}>;

export type ScrapeUrlData = WithMeta<{
  url: string;
}>;

export type EmbeddingGenerateData = WithMeta<{
  chunkIds: string[];
}>;

export type StripeWebhookData = WithMeta<{
  event: unknown;
}>;

export type JobDataMap = {
  [QUEUE_NAMES.agentRun]: AgentRunData;
  [QUEUE_NAMES.ragIngest]: RagIngestData;
  [QUEUE_NAMES.emailSend]: EmailSendData;
  [QUEUE_NAMES.webhookSend]: WebhookSendData;
  [QUEUE_NAMES.scrapeUrl]: ScrapeUrlData;
  [QUEUE_NAMES.embeddingGenerate]: EmbeddingGenerateData;
  [QUEUE_NAMES.stripeWebhook]: StripeWebhookData;
};
