import { db, schema } from "@axon/db";
import type { JobMeta } from "@axon/shared/queues";
import { eq } from "drizzle-orm";

export async function markRunning(meta: JobMeta) {
  await db
    .update(schema.jobs)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(schema.jobs.id, meta.jobId));
}

export async function markCompleted(meta: JobMeta, output: unknown) {
  await db
    .update(schema.jobs)
    .set({ status: "completed", output: output as object, completedAt: new Date() })
    .where(eq(schema.jobs.id, meta.jobId));
}

export async function markFailed(meta: JobMeta, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  await db
    .update(schema.jobs)
    .set({ status: "failed", error: message, completedAt: new Date() })
    .where(eq(schema.jobs.id, meta.jobId));
}
