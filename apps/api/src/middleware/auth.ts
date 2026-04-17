import { db, schema } from "@axon/db";
import { and, eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { auth } from "../lib/auth";

declare module "fastify" {
  interface FastifyRequest {
    user: { id: string; email: string; name: string | null };
    organization: { id: string; plan: string; slug: string; name: string };
    memberRole: "owner" | "admin" | "member" | "viewer";
  }
}

function nodeHeaders(req: FastifyRequest): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    if (Array.isArray(v)) for (const vv of v) h.append(k, vv);
    else h.set(k, String(v));
  }
  return h;
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({ headers: nodeHeaders(req) });
  if (!session) return reply.code(401).send({ error: "unauthorized" });

  req.user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
  };

  const headerOrg = req.headers["x-organization-id"];
  const orgId =
    (typeof headerOrg === "string" ? headerOrg : null) ?? session.session.activeOrganizationId;

  if (!orgId) {
    return reply.code(400).send({ error: "no_active_organization" });
  }

  const member = await db.query.members.findFirst({
    where: and(eq(schema.members.userId, req.user.id), eq(schema.members.organizationId, orgId)),
    with: { organization: true },
  });

  if (!member) {
    return reply.code(403).send({ error: "not_a_member" });
  }

  const org = member.organization;
  req.organization = { id: org.id, plan: org.plan, slug: org.slug, name: org.name };
  req.memberRole = member.role;
}
