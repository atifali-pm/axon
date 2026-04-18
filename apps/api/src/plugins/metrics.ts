import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Counter, Gauge, Histogram, collectDefaultMetrics, register } from "prom-client";

/**
 * Prometheus metrics for the API. Exposes:
 *   - axon_http_request_duration_seconds (histogram, labels: method, route, status)
 *   - axon_http_requests_total (counter, labels: method, route, status)
 *   - axon_http_active_requests (gauge)
 *   - default node metrics: CPU, heap, event loop lag, GC, etc.
 *
 * Mounted at GET /metrics. Scraped by Prometheus per infra/observability/prometheus/prometheus.yml.
 * The /metrics endpoint itself is NOT labeled as a request to keep the dashboards clean.
 */

let defaultCollected = false;

const httpDuration = new Histogram({
  name: "axon_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const httpTotal = new Counter({
  name: "axon_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"] as const,
});

const httpActive = new Gauge({
  name: "axon_http_active_requests",
  help: "In-flight HTTP requests",
});

const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  if (!defaultCollected) {
    collectDefaultMetrics({ prefix: "axon_node_" });
    defaultCollected = true;
  }

  app.addHook("onRequest", async (req) => {
    if (req.url === "/metrics") return;
    httpActive.inc();
    (req as unknown as { _metricsStart?: bigint })._metricsStart = process.hrtime.bigint();
  });

  app.addHook("onResponse", async (req, reply) => {
    if (req.url === "/metrics") return;
    const startNs = (req as unknown as { _metricsStart?: bigint })._metricsStart;
    if (startNs == null) return;
    const seconds = Number(process.hrtime.bigint() - startNs) / 1e9;
    const routeKey = req.routeOptions?.url ?? req.url.split("?")[0] ?? "unknown";
    const labels = {
      method: req.method,
      route: routeKey,
      status: String(reply.statusCode),
    };
    httpDuration.observe(labels, seconds);
    httpTotal.inc(labels);
    httpActive.dec();
  });

  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });
};

export const metricsPlugin = fp(plugin, { name: "axon-metrics" });
