import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import Fastify from "fastify";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenvExpand.expand(dotenv.config({ path: path.resolve(here, "../../../.env") }));

const { requireAuth } = await import("./middleware/auth");
const { documentRoutes } = await import("./routes/documents");

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport:
      process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
  },
});

const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const extraOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

await app.register(cors, {
  origin: [appUrl, ...extraOrigins],
  credentials: true,
});

app.get("/health", async () => ({ ok: true, service: "api" }));

app.get("/api/me", { preHandler: requireAuth }, async (req) => ({
  user: req.user,
  organization: req.organization,
  role: req.memberRole,
}));

await app.register(documentRoutes, { prefix: "/api/documents" });

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
