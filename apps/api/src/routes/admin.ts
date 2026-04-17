import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../middleware/auth";
import { queues } from "../queues";

const BASE_PATH = "/admin/queues";

async function requireOwnerOrAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (req.memberRole !== "owner" && req.memberRole !== "admin") {
    return reply.code(403).send({ error: "requires_owner_or_admin" });
  }
}

export async function registerBullBoard(app: FastifyInstance) {
  const serverAdapter = new FastifyAdapter();
  createBullBoard({
    queues: Object.values(queues).map((q) => new BullMQAdapter(q)),
    serverAdapter,
    options: { uiConfig: { boardTitle: "Axon Queues" } },
  });
  serverAdapter.setBasePath(BASE_PATH);

  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith(BASE_PATH)) return;
    await requireOwnerOrAdmin(req, reply);
  });

  await app.register(serverAdapter.registerPlugin(), { prefix: BASE_PATH });
}
