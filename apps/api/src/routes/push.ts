import { db, schema } from "@axon/db";
import { and, eq } from "drizzle-orm";
import { Expo } from "expo-server-sdk";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth";

type RegisterBody = {
  token?: string;
  platform?: string;
  deviceName?: string;
};

export async function pushRoutes(app: FastifyInstance) {
  app.post<{ Body: RegisterBody }>(
    "/register",
    { preHandler: requireAuth },
    async (req, reply) => {
      const body = req.body ?? {};
      const token = body.token?.trim();
      const platform = body.platform?.trim();
      if (!token || !platform) {
        return reply.code(400).send({ error: "token_and_platform_required" });
      }
      if (!Expo.isExpoPushToken(token)) {
        return reply.code(400).send({ error: "invalid_expo_push_token" });
      }

      // Upsert by (user_id, token): refresh last_seen_at so stale tokens
      // naturally age out via a periodic cleanup job (future work).
      const existing = await db.query.pushTokens.findFirst({
        where: and(
          eq(schema.pushTokens.userId, req.user.id),
          eq(schema.pushTokens.token, token),
        ),
      });
      if (existing) {
        await db
          .update(schema.pushTokens)
          .set({ lastSeenAt: new Date(), platform, deviceName: body.deviceName ?? null })
          .where(eq(schema.pushTokens.id, existing.id));
      } else {
        await db.insert(schema.pushTokens).values({
          userId: req.user.id,
          token,
          platform,
          deviceName: body.deviceName ?? null,
        });
      }
      return { ok: true };
    },
  );

  app.post<{ Body: { token?: string } }>(
    "/unregister",
    { preHandler: requireAuth },
    async (req, reply) => {
      const token = req.body?.token?.trim();
      if (!token) return reply.code(400).send({ error: "token_required" });
      await db
        .delete(schema.pushTokens)
        .where(
          and(
            eq(schema.pushTokens.userId, req.user.id),
            eq(schema.pushTokens.token, token),
          ),
        );
      return { ok: true };
    },
  );
}
