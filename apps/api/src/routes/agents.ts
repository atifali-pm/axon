/**
 * Agent templates API.
 *
 *   GET    /api/agents             list my org's templates
 *   POST   /api/agents             create
 *   GET    /api/agents/:id         fetch one (must be mine, unless public)
 *   PATCH  /api/agents/:id         update (owner only)
 *   DELETE /api/agents/:id         delete (owner only)
 *   POST   /api/agents/:id/fork    copy a public template into my workspace
 *   GET    /api/agents/public      discovery feed, paginated
 *
 * RLS model:
 *   - Owner operations go through withOrg so the axon_app role + GUC apply.
 *   - Public discovery uses the superuser `db` (postgres) and filters
 *     on is_public = true explicitly. This is the only path where an org
 *     can read a row owned by another org, and the filter is enforced in
 *     SQL so the query plan can't accidentally widen.
 */
import { db, schema, withOrg } from "@axon/db";
import { and, desc, eq, ne } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../middleware/auth";

const VALID_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

type CreateBody = {
  name?: string;
  slug?: string;
  description?: string;
  systemPrompt?: string;
  allowedTools?: string[];
  allowedProviders?: string[];
  samplePrompts?: string[];
  isPublic?: boolean;
};

type UpdateBody = Partial<CreateBody>;

function isValidStringArray(x: unknown, max = 50): x is string[] {
  return Array.isArray(x) && x.length <= max && x.every((s) => typeof s === "string");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function requireOwnerOrAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (req.memberRole !== "owner" && req.memberRole !== "admin") {
    return reply.code(403).send({ error: "owner_or_admin_only" });
  }
}

export async function agentRoutes(app: FastifyInstance) {
  // Public discovery — no auth. Paginated, order by fork count then recency.
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    "/public",
    async (req) => {
      const limit = Math.min(50, Math.max(1, Number(req.query?.limit ?? 20) || 20));
      const offset = Math.max(0, Number(req.query?.offset ?? 0) || 0);
      const rows = await db
        .select({
          id: schema.agentTemplates.id,
          slug: schema.agentTemplates.slug,
          name: schema.agentTemplates.name,
          description: schema.agentTemplates.description,
          samplePrompts: schema.agentTemplates.samplePrompts,
          forkCount: schema.agentTemplates.forkCount,
          createdAt: schema.agentTemplates.createdAt,
          organizationName: schema.organizations.name,
        })
        .from(schema.agentTemplates)
        .innerJoin(
          schema.organizations,
          eq(schema.organizations.id, schema.agentTemplates.organizationId),
        )
        .where(eq(schema.agentTemplates.isPublic, true))
        .orderBy(desc(schema.agentTemplates.forkCount), desc(schema.agentTemplates.createdAt))
        .limit(limit)
        .offset(offset);
      return { templates: rows };
    },
  );

  // List my org's templates.
  app.get("/", { preHandler: requireAuth }, async (req) => {
    const rows = await withOrg(req.organization.id, (tx) =>
      tx.query.agentTemplates.findMany({
        orderBy: [desc(schema.agentTemplates.createdAt)],
        limit: 100,
      }),
    );
    return { templates: rows };
  });

  // Fetch one. RLS blocks cross-org reads automatically for non-public rows.
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      // First try within the org.
      const own = await withOrg(req.organization.id, (tx) =>
        tx.query.agentTemplates.findFirst({
          where: and(
            eq(schema.agentTemplates.id, req.params.id),
            eq(schema.agentTemplates.organizationId, req.organization.id),
          ),
        }),
      );
      if (own) return own;

      // Fall back to the public catalogue.
      const pub = await db.query.agentTemplates.findFirst({
        where: and(
          eq(schema.agentTemplates.id, req.params.id),
          eq(schema.agentTemplates.isPublic, true),
        ),
      });
      if (!pub) return reply.code(404).send({ error: "not_found" });
      return pub;
    },
  );

  app.post<{ Body: CreateBody }>(
    "/",
    { preHandler: requireOwnerOrAdmin },
    async (req, reply) => {
      const b = req.body ?? {};
      if (!b.name || !b.systemPrompt) {
        return reply.code(400).send({ error: "name_and_system_prompt_required" });
      }
      if (b.name.length > 80 || b.systemPrompt.length > 10_000) {
        return reply.code(400).send({ error: "field_too_long" });
      }
      if (b.allowedTools !== undefined && !isValidStringArray(b.allowedTools)) {
        return reply.code(400).send({ error: "allowed_tools_must_be_string_array" });
      }
      if (b.allowedProviders !== undefined && !isValidStringArray(b.allowedProviders, 10)) {
        return reply.code(400).send({ error: "allowed_providers_invalid" });
      }

      const slug = (b.slug && VALID_SLUG_RE.test(b.slug) ? b.slug : slugify(b.name)) || "agent";
      const row = await withOrg(req.organization.id, async (tx) => {
        const [created] = await tx
          .insert(schema.agentTemplates)
          .values({
            organizationId: req.organization.id,
            authorUserId: req.user.id,
            slug,
            name: b.name!,
            description: b.description ?? null,
            systemPrompt: b.systemPrompt!,
            allowedTools: b.allowedTools ?? [],
            allowedProviders: b.allowedProviders ?? [],
            samplePrompts: b.samplePrompts ?? [],
            isPublic: b.isPublic === true,
          })
          .returning();
        if (!created) throw new Error("failed to insert agent template");
        return created;
      });
      return reply.code(201).send(row);
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateBody }>(
    "/:id",
    { preHandler: requireOwnerOrAdmin },
    async (req, reply) => {
      const b = req.body ?? {};
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (b.name !== undefined) updates.name = b.name;
      if (b.description !== undefined) updates.description = b.description;
      if (b.systemPrompt !== undefined) updates.systemPrompt = b.systemPrompt;
      if (b.allowedTools !== undefined) updates.allowedTools = b.allowedTools;
      if (b.allowedProviders !== undefined) updates.allowedProviders = b.allowedProviders;
      if (b.samplePrompts !== undefined) updates.samplePrompts = b.samplePrompts;
      if (b.isPublic !== undefined) updates.isPublic = b.isPublic;

      const row = await withOrg(req.organization.id, async (tx) => {
        const rows = await tx
          .update(schema.agentTemplates)
          .set(updates)
          .where(
            and(
              eq(schema.agentTemplates.id, req.params.id),
              eq(schema.agentTemplates.organizationId, req.organization.id),
            ),
          )
          .returning();
        return rows[0];
      });
      if (!row) return reply.code(404).send({ error: "not_found" });
      return row;
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireOwnerOrAdmin },
    async (req, reply) => {
      const deleted = await withOrg(req.organization.id, async (tx) => {
        const rows = await tx
          .delete(schema.agentTemplates)
          .where(
            and(
              eq(schema.agentTemplates.id, req.params.id),
              eq(schema.agentTemplates.organizationId, req.organization.id),
            ),
          )
          .returning({ id: schema.agentTemplates.id });
        return rows[0];
      });
      if (!deleted) return reply.code(404).send({ error: "not_found" });
      return { ok: true };
    },
  );

  // Fork a public template into the caller's org. Refuse self-forks so the
  // "fork" count is meaningful as a social-proof signal.
  app.post<{ Params: { id: string } }>(
    "/:id/fork",
    { preHandler: requireOwnerOrAdmin },
    async (req, reply) => {
      const src = await db.query.agentTemplates.findFirst({
        where: and(
          eq(schema.agentTemplates.id, req.params.id),
          eq(schema.agentTemplates.isPublic, true),
          ne(schema.agentTemplates.organizationId, req.organization.id),
        ),
      });
      if (!src) return reply.code(404).send({ error: "not_found_or_not_public" });

      // Fork into the org via withOrg so RLS applies on the insert side too.
      const fork = await withOrg(req.organization.id, async (tx) => {
        const baseSlug = `${src.slug}-fork`.slice(0, 55);
        const stamp = Date.now().toString(36);
        const forkSlug = `${baseSlug}-${stamp}`;
        const [row] = await tx
          .insert(schema.agentTemplates)
          .values({
            organizationId: req.organization.id,
            authorUserId: req.user.id,
            slug: forkSlug,
            name: src.name,
            description: src.description,
            systemPrompt: src.systemPrompt,
            allowedTools: src.allowedTools,
            allowedProviders: src.allowedProviders,
            samplePrompts: src.samplePrompts,
            isPublic: false,
            forkedFromId: src.id,
          })
          .returning();
        return row;
      });
      if (!fork) return reply.code(500).send({ error: "fork_failed" });

      // Bump source fork_count via the superuser connection (we can't write
      // to another org's row through RLS).
      await db
        .update(schema.agentTemplates)
        .set({ forkCount: (src.forkCount ?? 0) + 1 })
        .where(eq(schema.agentTemplates.id, src.id));

      return reply.code(201).send(fork);
    },
  );
}
