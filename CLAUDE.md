# Axon

AI-powered agentic SaaS platform. A portfolio/learning project built to demonstrate full-stack AI engineering at production grade.

## What This Project Is

Axon is a multi-tenant AI platform that can adapt to any situation. It combines:
- Agentic AI (LangGraph agents with tool calling)
- RAG (document ingestion + vector search)
- Multi-LLM routing (Groq, Gemini, OpenRouter, Claude, GPT, Ollama)
- MCP servers (exposing integrations to agents and external clients)
- Queue-first architecture (BullMQ for all async work)
- Full observability (Langfuse for LLM tracing, Grafana/Prometheus/Loki for infra)

The goal is $0/month total cost using free tiers (Oracle Cloud, Groq, Gemini, Cloudflare).

## Why It Exists

Atif (the owner) is building this to:
1. Learn the modern AI/agentic stack hands-on
2. Add a flagship project to his freelancing portfolio (Upwork/Fiverr)
3. Demonstrate production-grade architecture to potential clients

He is a senior engineer with 20+ years experience. Do not over-explain basics. Do explain AI/agent concepts since those are newer to him.

## Blueprint Reference

The full architectural blueprint with code samples for every layer is at:
**`docs/end_to_end_saas_blueprint.md`**

Read this file before starting any phase. It contains complete code for:
- Docker Compose configs (dev + prod)
- Database schema (Drizzle ORM with pgvector)
- Queue system (BullMQ queues + workers + processors)
- API service (Fastify with auth, rate limiting, SSE streaming)
- Agent service (Python + LangGraph + FastAPI)
- LLM router (multi-provider with fallback)
- MCP servers (Postgres MCP example)
- Web frontend (Next.js + Vercel AI SDK chat)
- RAG pipeline (ingest, chunk, embed, hybrid search)
- Auth (Better Auth with org/multi-tenancy)
- Billing (Stripe checkout + webhooks)
- Observability (Langfuse + LGTM stack)
- Production deployment (Oracle Cloud + Caddy + Cloudflare Tunnel)
- CI/CD (GitHub Actions)
- Security hardening checklist
- Backup & disaster recovery

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js 15 + React 19 + Tailwind + shadcn/ui |
| API | Fastify 5 + TypeScript + Zod |
| Agents | Python 3.12 + LangGraph + FastAPI |
| Queue | BullMQ (Node) + Redis |
| DB | PostgreSQL 16 + pgvector + Drizzle ORM |
| Cache | Redis 7 |
| Storage | MinIO (self-hosted S3) or Cloudflare R2 |
| Auth | Better Auth (self-hosted) |
| Payments | Stripe |
| Email | Resend |
| Automation | n8n (self-hosted) |
| LLM primary | Groq (Llama 3.3) + Gemini Flash (free tiers) |
| LLM local | Ollama |
| LLM observability | Langfuse (self-hosted) |
| Metrics | Prometheus + Grafana |
| Logs | Loki + Promtail |
| Reverse proxy | Caddy (auto-HTTPS) |
| Tunnel | Cloudflare Tunnel |
| VM | Oracle Cloud Always Free (4 ARM cores, 24GB RAM) |
| CI/CD | GitHub Actions |

## Monorepo Structure

```
axon/
+-- apps/
|   +-- web/          # Next.js 15 frontend
|   +-- api/          # Fastify 5 backend
|   +-- worker/       # BullMQ queue consumers (Node)
|   +-- agents/       # Python agent service (LangGraph + FastAPI)
|
+-- packages/
|   +-- db/           # Shared DB schema + Drizzle migrations
|   +-- shared/       # Shared types + Zod schemas + constants
|   +-- ui/           # Shared React components (shadcn/ui)
|   +-- mcp-servers/  # MCP servers (postgres, github, stripe, custom)
|
+-- infra/
|   +-- docker/       # Docker Compose (dev, prod, observability), Caddyfile, init-db SQL
|   +-- observability/ # Prometheus, Loki, Promtail, Grafana configs
|   +-- oracle-vm/    # VM setup scripts
|   +-- cloudflare/   # Tunnel config
|
+-- scripts/          # bootstrap, seed, backup, restore, generate-secrets
+-- docs/             # Blueprint and architecture docs
```

## Build Phases

Build in this exact order. Each phase produces something runnable. Do not skip ahead.

### Phase 1: Foundation (monorepo + infra + shells)

**Goal**: pnpm install works, Docker infra boots, all 4 app shells start.

Tasks:
1. Root monorepo config: package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json
2. Create all directories from the structure above
3. apps/web: Initialize Next.js 15 with Tailwind + shadcn/ui. Just a landing page that says "Axon" with a health check.
4. apps/api: Initialize Fastify 5 with TypeScript. GET /health returns { ok: true }. Dockerfile with dev target.
5. apps/worker: Skeleton with a dummy worker that logs "worker ready". Dockerfile with dev target.
6. apps/agents: Python project with pyproject.toml. FastAPI with GET /health. Dockerfile with dev target.
7. packages/db: Empty Drizzle package with package.json. No schema yet.
8. packages/shared: Empty package with types.ts and constants.ts stubs.
9. packages/ui: Empty package (placeholder for shadcn components later).
10. infra/docker/docker-compose.dev.yml: Postgres (pgvector), Redis, MinIO. Only data layer, no app containers yet (apps run on host for dev speed in Phase 1).
11. infra/docker/init-db/01-init.sql: Create n8n + langfuse databases, enable pgvector/pg_trgm/uuid-ossp extensions.
12. .env.example with all variables. scripts/generate-secrets.sh to auto-fill.
13. .gitignore, .dockerignore, README.md
14. Verify: `docker compose up -d` starts Postgres+Redis+MinIO. `pnpm install && pnpm dev` starts all 4 apps. Health endpoints respond.

**Milestone**: Running monorepo with 4 healthy services + Docker infra.

### Phase 2: Database + Auth

**Goal**: Users can sign up, log in, create organizations. DB schema is real.

Tasks:
1. packages/db/schema.ts: Full schema from blueprint (organizations, users, members, sessions, accounts, apiKeys, jobs, documents, chunks, conversations, messages, usage).
2. Drizzle config + migration scripts. Run first migration.
3. apps/web: Install Better Auth. Implement signup/login pages (email+password + GitHub OAuth + Google OAuth).
4. apps/api: Auth plugin (Better Auth). requireAuth middleware with tenant isolation. x-organization-id header pattern.
5. apps/web: Organization creation + switching UI.
6. Postgres Row-Level Security policies on tenant-scoped tables.
7. Verify: Full auth flow works. Create org, invite member, switch orgs. RLS blocks cross-tenant access.

**Milestone**: Working multi-tenant auth system.

### Phase 3: Queue System + Workers

**Goal**: Async job processing works end-to-end.

Tasks:
1. apps/api/src/queues/index.ts: All queue definitions (agent.run, rag.ingest, email.send, webhook.send, scrape.url, embedding.generate, stripe.webhook).
2. apps/api: enqueue() helper with tenant context (_meta.orgId pattern).
3. apps/worker/src/worker.ts: Worker bootstrap with all processors registered.
4. apps/worker/src/processors/: Stub processors for each queue. Log + mark job complete for now.
5. apps/api/src/routes/admin.ts: Bull Board UI at /admin/queues (protected).
6. jobs table: API creates job record, enqueues, worker updates status. GET /api/chat/jobs/:id to poll.
7. Verify: POST to API enqueues a job. Worker picks it up, processes, marks complete. Bull Board shows the flow.

**Milestone**: Queue-first architecture working. Any future feature just needs a new processor.

### Phase 4: Agent Service (Python + LangGraph)

**Goal**: Chat with an AI agent that can use tools.

Tasks:
1. apps/agents: Full FastAPI setup with /run and /stream endpoints.
2. apps/agents/src/llm_router.py: Multi-provider router (Groq primary, Gemini fallback, OpenRouter, Anthropic, OpenAI, Ollama).
3. apps/agents/src/agents/default_agent.py: LangGraph agent with tool calling loop.
4. apps/agents/src/tools/: At least 2 working tools (web_search, db_query). RAG search tool can be a stub until Phase 5.
5. apps/agents/src/observability.py: Langfuse callback handler.
6. Wire API -> Agent Service: POST /api/chat calls agent service. Streaming mode via SSE. Async mode via queue.
7. apps/worker/src/processors/agent-run.ts: Real processor that calls Python agent service.
8. apps/web/src/app/chat/page.tsx: Chat UI using Vercel AI SDK useChat hook.
9. Add n8n + langfuse to docker-compose.dev.yml. Langfuse receives traces.
10. Verify: Type a message in the web UI. See it stream through API -> agents -> LLM -> tools -> response. See the trace in Langfuse.

**Milestone**: Working AI chat with tool calling and LLM tracing.

### Phase 5: RAG Pipeline

**Goal**: Upload documents, ask questions about them, get answers grounded in your data.

Tasks:
1. apps/api/src/routes/documents.ts: Upload endpoint (accept PDF, DOCX, TXT, URL). Store in MinIO. Create document record.
2. apps/worker/src/processors/rag-ingest.ts: Extract text -> chunk (500 tokens, 50 overlap) -> generate embeddings (Ollama nomic-embed-text) -> bulk insert into chunks table with vectors.
3. apps/worker/src/lib/embeddings.ts: Ollama embedding client.
4. apps/worker/src/lib/chunker.ts: Token-aware text chunker with overlap.
5. apps/worker/src/lib/extractors.ts: PDF, DOCX, HTML, plain text extractors.
6. Hybrid search function: vector similarity (pgvector HNSW) + Postgres FTS, weighted 70/30, return top 10.
7. apps/agents/src/tools/rag_search.py: Real RAG search tool that the agent can call. Scoped to org.
8. apps/web: Document upload UI. List documents. See chunk count.
9. Verify: Upload a PDF. See it chunked + embedded. Ask a question. Agent uses RAG tool. Answer is grounded in the document content.

**Milestone**: Full RAG pipeline. Upload -> chunk -> embed -> search -> ground agent responses.

### Phase 6: MCP Servers

**Goal**: Expose integrations as MCP servers usable by agents and external clients (Claude Desktop).

Tasks:
1. packages/mcp-servers/postgres-mcp/: Read-only SQL query + list_tables tools.
2. packages/mcp-servers/github-mcp/: List repos, search code, create issue.
3. packages/mcp-servers/stripe-mcp/: List customers, list invoices, get subscription.
4. packages/mcp-servers/custom-mcp/: Template for building new ones quickly.
5. Wire MCP servers as agent tools (agents call MCP tools via HTTP/stdio bridge).
6. Claude Desktop config for local development (connect to Axon MCP servers).
7. Verify: Agent can query the database via MCP. Claude Desktop can connect to Axon's MCP servers.

**Milestone**: MCP-native platform. Agents and external clients use same tool interface.

### Phase 7: Observability

**Goal**: Full production monitoring. Know when things break before users do.

Tasks:
1. infra/docker/docker-compose.observability.yml: Prometheus, Grafana, Loki, Promtail, cAdvisor, Node Exporter, Postgres exporter, Redis exporter, Blackbox exporter.
2. infra/observability/: All config files (prometheus.yml, alerts.yml, loki-config.yml, promtail-config.yml, blackbox.yml, grafana provisioning).
3. apps/api: /metrics endpoint (prom-client). Request duration, error rate, active connections histograms.
4. Import Grafana dashboards: Node Exporter (1860), cAdvisor (14282), Postgres (9628), Redis (11835), Blackbox (7587), Loki (13639).
5. Grafana alerting: ntfy.sh integration for free phone push notifications.
6. Langfuse: Verify traces show up with latency, token counts, cost breakdown per org.
7. Verify: Grafana shows live metrics. Loki shows logs from all containers. Alerts fire on test failure condition.

**Milestone**: Production-grade observability. Dashboard for everything.

### Phase 8: Billing + CI/CD + Production Deploy

**Goal**: Users can pay. Code auto-deploys. Runs on a real server.

Tasks:
1. apps/api/src/routes/billing.ts: Stripe checkout session, portal, webhook handler.
2. apps/worker/src/processors/stripe-webhook.ts: Handle subscription.created/updated/deleted, invoice.payment_failed.
3. Plan enforcement middleware: check org.plan, reject if over limits.
4. apps/web: Pricing page, billing page, upgrade flow.
5. .github/workflows/ci.yml: Lint + typecheck + test on PR.
6. .github/workflows/deploy-*.yml: Build Docker images for linux/arm64, push to GHCR, SSH deploy to Oracle VM.
7. Oracle VM: Provision Always Free ARM instance. Run setup.sh.
8. Cloudflare Tunnel: Configure tunnel + DNS for all subdomains.
9. infra/docker/docker-compose.prod.yml: Production compose (pulls from GHCR, no port exposure except Caddy).
10. infra/docker/Caddyfile: Reverse proxy for all subdomains.
11. scripts/backup-db.sh: Automated Postgres backup to Cloudflare R2.
12. Security hardening: Full checklist from blueprint section 20.
13. Verify: Push to main triggers deploy. App runs on real domain. Stripe test payment works.

**Milestone**: Production deployment. Real URL, auto-deploy, payments, backups.

## Conventions

- Package names use `@axon/` prefix (e.g., `@axon/db`, `@axon/shared`, `@axon/ui`)
- TypeScript for all Node services. Python for agent service only.
- Zod for all input validation (API routes, queue job data).
- Drizzle ORM for all database access. No raw SQL except for complex pgvector queries.
- Every slow/failable operation goes through BullMQ. Never do LLM calls, emails, scrapes, or embeddings synchronously in an API request.
- Tenant isolation: every DB query must be scoped to organization_id. RLS as a safety net.
- Environment: all secrets via env vars. Never hardcode. .env in .gitignore.
- Docker: dev uses host-mounted volumes for hot reload. Prod uses built images from GHCR.

## Local Dev Quickstart

```bash
# 1. Start data layer
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 2. Install deps
pnpm install

# 3. Run migrations
pnpm db:migrate

# 4. Start all services
pnpm dev

# Access points:
# Web:      http://localhost:3000
# API:      http://localhost:4000
# Agents:   http://localhost:8000
# n8n:      http://localhost:5678
# Langfuse: http://localhost:3001
# MinIO:    http://localhost:9001
```

## Key Ports

| Service | Port |
|---|---|
| Next.js (web) | 3000 |
| Langfuse | 3001 |
| Grafana | 3002 |
| Fastify (API) | 4000 |
| Postgres | 5432 |
| n8n | 5678 |
| Redis | 6379 |
| Agents (FastAPI) | 8000 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

## Important Notes

- Read `docs/end_to_end_saas_blueprint.md` for complete code samples before implementing any section.
- Atif prefers building incrementally. Each phase should produce something testable. Do not scaffold empty files for future phases.
- Do not use em dashes in any written content.
- Do not use " - " (space-hyphen-space) as a sentence pause.
- When in doubt about a decision, check the blueprint first, then ask.
