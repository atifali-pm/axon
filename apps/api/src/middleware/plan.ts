import type { FastifyReply, FastifyRequest } from "fastify";

export const PLAN_ORDER = ["free", "starter", "pro", "enterprise"] as const;
export type Plan = (typeof PLAN_ORDER)[number];

/**
 * Gate a route on minimum plan. Use after `requireAuth` in preHandler chain.
 *
 *   fastify.post("/foo", { preHandler: [requireAuth, requirePlan("pro")] }, handler)
 */
export function requirePlan(min: Plan) {
  const minRank = PLAN_ORDER.indexOf(min);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const current = (req.organization?.plan ?? "free") as Plan;
    const rank = PLAN_ORDER.indexOf(current);
    if (rank < minRank) {
      return reply.code(402).send({
        error: "upgrade_required",
        currentPlan: current,
        requiredPlan: min,
      });
    }
  };
}

// Feature limits per plan. Tune to match product copy in /pricing.
export const LIMITS: Record<Plan, {
  documents: number;
  chatMessagesPerMonth: number;
  members: number;
}> = {
  free: { documents: 25, chatMessagesPerMonth: 200, members: 3 },
  starter: { documents: 500, chatMessagesPerMonth: 5_000, members: 10 },
  pro: { documents: 10_000, chatMessagesPerMonth: 50_000, members: 50 },
  enterprise: { documents: Number.POSITIVE_INFINITY, chatMessagesPerMonth: Number.POSITIVE_INFINITY, members: Number.POSITIVE_INFINITY },
};
