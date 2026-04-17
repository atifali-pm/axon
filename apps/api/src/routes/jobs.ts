import { db, schema } from "@axon/db";
import { QUEUE_NAMES } from "@axon/shared/queues";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth";
import { enqueue } from "../queues";

export async function jobRoutes(app: FastifyInstance) {
  // Demo endpoint: enqueues an agent.run stub job against the active org.
  // Real chat routes land in Phase 4; for now this proves the queue path.
  app.post<{
    Body: { message?: string; agentId?: string };
  }>("/", { preHandler: requireAuth }, async (req, reply) => {
    const message = req.body?.message;
    if (!message) return reply.code(400).send({ error: "message_required" });

    const row = await enqueue(
      QUEUE_NAMES.agentRun,
      "run",
      {
        agentId: req.body?.agentId ?? "default",
        message,
        conversationId: null,
      },
      req.organization.id,
    );

    return { jobId: row.id, status: row.status };
  });

  app.get("/", { preHandler: requireAuth }, async (req) => {
    const rows = await db.query.jobs.findMany({
      where: eq(schema.jobs.organizationId, req.organization.id),
      orderBy: [desc(schema.jobs.createdAt)],
      limit: 10,
    });
    return { jobs: rows };
  });

  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const job = await db.query.jobs.findFirst({
        where: and(
          eq(schema.jobs.id, req.params.id),
          eq(schema.jobs.organizationId, req.organization.id),
        ),
      });
      if (!job) return reply.code(404).send({ error: "not_found" });
      return job;
    },
  );
}
