import type { ScrapeUrlData } from "@axon/shared/queues";
import type { Job } from "bullmq";
import { logger } from "../lib/logger";

export async function scrapeUrlProcessor(job: Job<ScrapeUrlData>) {
  const { _meta, url } = job.data;
  logger.info({ jobId: _meta.jobId, url }, "scrape.url stub");
  return { stub: true };
}
