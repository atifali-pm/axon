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
const { jobRoutes } = await import("./routes/jobs");
const { chatRoutes } = await import("./routes/chat");
const { registerBullBoard } = await import("./routes/admin");

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

const multipart = (await import("@fastify/multipart")).default;
await app.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

app.get("/health", async () => ({ ok: true, service: "api" }));

app.get("/api/me", { preHandler: requireAuth }, async (req) => ({
  user: req.user,
  organization: req.organization,
  role: req.memberRole,
}));

await app.register(documentRoutes, { prefix: "/api/documents" });
await app.register(jobRoutes, { prefix: "/api/jobs" });
await app.register(chatRoutes, { prefix: "/api/chat" });
await registerBullBoard(app);

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

app.listen({ port, host })
  .then(() => {
    if (process.env.DEBUG_ROUTES === "1") {
      console.log(app.printRoutes({ commonPrefix: false }));
    }
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
