import { schema, withOrg } from "@axon/db";
import { desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth";

export async function documentRoutes(app: FastifyInstance) {
  app.post<{ Body: { title: string; source?: string } }>(
    "/",
    { preHandler: requireAuth },
    async (req, reply) => {
      const body = req.body;
      if (!body?.title) return reply.code(400).send({ error: "title_required" });

      const doc = await withOrg(req.organization.id, async (tx) => {
        const [row] = await tx
          .insert(schema.documents)
          .values({
            organizationId: req.organization.id,
            title: body.title,
            source: body.source ?? null,
          })
          .returning();
        return row;
      });

      return doc;
    },
  );

  app.get("/", { preHandler: requireAuth }, async (req) => {
    const rows = await withOrg(req.organization.id, (tx) =>
      tx.query.documents.findMany({
        orderBy: [desc(schema.documents.createdAt)],
        limit: 50,
      }),
    );
    return { documents: rows };
  });
}
