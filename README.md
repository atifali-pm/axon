# Axon

> Production-grade AI agent SaaS, built in public. Multi-tenant, queue-first, MCP-native, $0 stack.

[![Node 20](https://img.shields.io/badge/node-20+-3c873a)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-9.12-f69220)](https://pnpm.io)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-000)](https://nextjs.org)
[![Fastify 5](https://img.shields.io/badge/Fastify-5-000)](https://fastify.dev)
[![Python 3.12](https://img.shields.io/badge/python-3.12-3776ab)](https://python.org)
[![Postgres 16](https://img.shields.io/badge/postgres-16+pgvector-336791)](https://postgresql.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Axon is the reference codebase for a modern AI agent platform: agentic chat with tool calls, per-tenant RAG, queue-first async work, multi-LLM routing, MCP integrations, and full observability. Every layer ships as runnable code, not slides.

---

## What's inside

- **Agentic chat** (Phase 4): LangGraph agents with tool calling, streaming via SSE
- **Multi-tenant RAG** (Phase 5): document upload → chunk → embed → hybrid vector + FTS search, per-org isolation
- **Queue-first architecture**: every LLM call, scrape, email, embed job goes through BullMQ (Phase 3 live)
- **Row-level security**: Postgres RLS policies gate every tenant-scoped query at the DB (Phase 2 live, runtime-enforced)
- **Better Auth**: email/password + session cookies + org plugin, cross-service cookie verification (Phase 2 live)
- **Multi-LLM router** (Phase 4): Groq primary, Gemini fallback, OpenRouter/Claude/GPT/Ollama as needed
- **MCP servers** (Phase 6): Postgres, GitHub, Stripe — usable by Axon agents and external clients like Claude Desktop
- **Observability** (Phase 7): Langfuse for LLM traces, Prometheus + Grafana + Loki for infra
- **$0 deploy target** (Phase 8): Oracle Cloud Always Free ARM + Cloudflare Tunnel + Caddy auto-HTTPS

## Architecture

```
+------------------------------------------------------------------------+
|                        BROWSER / EXTERNAL CLIENTS                       |
+--+------------------------+-----------------------+---------------------+
   | app.axon.xyz           | api.axon.xyz          | MCP clients         |
   v                        v                       v                     |
+------------+   +-----------------+   +----------------------+           |
|  Next.js   |   |  Fastify API    |   |  MCP servers (stdio) |           |
|  (web)     |-->|  + Better Auth  |   |  postgres / github   |           |
|            |   |  + BullMQ       |   |  stripe / custom     |           |
+------------+   +--------+--------+   +----------------------+           |
                          |                                                |
                   enqueue|                                                |
                          v                                                |
              +----------------------+      +----------------------+       |
              |  BullMQ workers      |<---->|  Python agents svc  |       |
              |  (7 processors)      | HTTP |  LangGraph + tools  |       |
              +-----------+----------+      +----------+-----------+       |
                          |                            |                   |
                          v                            v                   |
         +-------------------------------------------------------+         |
         |   Postgres 16 + pgvector   |  Redis 7  |  MinIO (S3) |         |
         |   (RLS per-tenant)         |  queue+cache| storage   |         |
         +-------------------------------------------------------+         |
                          |                                                |
                          v                                                |
         +-------------------------------------------------------+         |
         |  Langfuse (LLM traces) | Grafana/Prometheus/Loki     |         |
         +-------------------------------------------------------+         |
                                                                           |
         Outbound: Groq | Gemini | OpenRouter | Stripe | Resend           |
+------------------------------------------------------------------------+
```

## Tech stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js 15, React 19, Tailwind, shadcn/ui |
| API | Fastify 5, Zod, Better Auth |
| Agents | Python 3.12, LangGraph, FastAPI |
| Queue | BullMQ 5 + Redis 7 |
| Database | Postgres 16 + pgvector, Drizzle ORM 0.45 |
| Storage | MinIO (S3-compatible) or Cloudflare R2 |
| Auth | Better Auth (self-hosted) with organization plugin |
| LLMs | Groq (Llama 3.3), Gemini Flash, Claude, GPT, Ollama |
| Observability | Langfuse + Prometheus + Grafana + Loki |
| Deploy | Docker + Caddy + Cloudflare Tunnel + Oracle Cloud ARM |

## Build phases

| Phase | Milestone | Status |
|---|---|---|
| 1 | Monorepo + Docker data layer + 4 app shells | ✅ shipped |
| 2 | Drizzle schema + Better Auth + multi-tenant + **RLS enforced at runtime** | ✅ shipped |
| 3 | BullMQ queue system + workers + Bull Board | ✅ shipped |
| 4 | Python agents + LangGraph + multi-LLM router + SSE chat | ⏳ next |
| 5 | RAG pipeline: upload → chunk → embed → hybrid search | ⏳ |
| 6 | MCP servers (postgres, github, stripe, custom) | ⏳ |
| 7 | Observability (Langfuse, LGTM stack, dashboards, alerts) | ⏳ |
| 8 | Production deploy (Oracle Cloud + Cloudflare + CI/CD + billing) | ⏳ |

Each phase produces something runnable. See [CLAUDE.md](CLAUDE.md) for the full task breakdown.

## Screenshots

Captured via Playwright; regenerate with `pnpm screenshots`. Placeholder sizes are suggestions.

| Landing | Signup | Dashboard (orgs) |
|---|---|---|
| ![landing](docs/images/landing.png) | ![signup](docs/images/signup.png) | ![dashboard](docs/images/dashboard.png) |

| Bull Board | API /api/me | Schema diagram |
|---|---|---|
| ![bull-board](docs/images/bull-board.png) | ![api-me](docs/images/api-me.png) | ![schema](docs/images/schema.png) |

## What makes this different

**Tenant isolation that actually holds.** Most SaaS tutorials stop at "filter by org_id in every query." Axon enforces it at the database with Postgres RLS: the API connects as a non-superuser role, every tenant-scoped query runs inside a transaction that sets `app.current_org_id` via `set_config(..., true)`, and policies block reads + writes that don't match. Dropping the `where` clause in application code still leaks zero rows.

**Queue-first, not queue-maybe.** Every slow or failable op is a BullMQ job from day one. The API never calls an LLM inline, never sends an email inline, never scrapes inline. This is the architecture that doesn't fall over in production.

**Typed across the workspace.** Shared queue-name constants + per-queue job types live in `@axon/shared/queues`. The API's `enqueue()`, the worker's processors, and the job polling endpoint all agree at compile time.

**Cost discipline.** The whole production stack runs on free tiers: Oracle Cloud Always Free ARM VM, Cloudflare Tunnel, Groq + Gemini free tiers, Resend 3k/mo, MinIO self-hosted. ~$2/yr for a `.xyz` domain is the only recurring cost.

## Local dev

```bash
# 1. Secrets (patches .env in place; re-runnable)
cp .env.example .env
./scripts/generate-secrets.sh

# 2. Data layer (Postgres+pgvector, Redis, MinIO)
pnpm docker:up

# 3. Install + migrate
pnpm install
pnpm --filter @axon/db migrate

# 4. Start services
pnpm dev
```

### Prerequisites

- Node.js 20+, pnpm 9+ (`corepack enable`)
- Python 3.12+ (agents service, from Phase 4)
- Docker + Docker Compose

### Access points

| Service | URL |
|---|---|
| Web | http://localhost:3000 (set `WEB_PORT` to override, e.g. 3100) |
| API | http://localhost:4000 |
| Agents (Python) | http://localhost:8000 |
| Bull Board | http://localhost:4000/admin/queues (owner/admin only) |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |
| MinIO | http://localhost:9001 |

### Health checks

```bash
curl http://localhost:4000/health
curl http://localhost:3000/api/health
curl http://localhost:8000/health   # Phase 4+
```

## Repo layout

```
axon/
├── apps/
│   ├── web/          Next.js 15 frontend
│   ├── api/          Fastify 5 backend + BullMQ producer
│   ├── worker/       BullMQ consumers (7 queues)
│   └── agents/       Python + FastAPI + LangGraph
├── packages/
│   ├── db/           Drizzle schema + migrations + withOrg helper
│   ├── shared/       Cross-service types, queue names, auth factory
│   ├── ui/           Shared shadcn/ui components
│   └── mcp-servers/  MCP servers (postgres, github, stripe, custom)
├── infra/
│   ├── docker/       Compose dev + prod + observability
│   ├── observability/ Prometheus, Loki, Promtail, Grafana
│   ├── oracle-vm/    Production VM setup
│   └── cloudflare/   Tunnel config
├── scripts/          bootstrap, secrets, screenshots, backup
└── docs/             Architecture blueprint, portfolio pack
```

## Freelance / hire

Built by [Atif Ali](https://github.com/atifali-pm). Available on Upwork and Fiverr for:
- AI agent platforms (LangGraph, LangChain, MCP)
- Multi-tenant SaaS with per-tenant RAG
- Queue-first Node backends (BullMQ, Fastify)
- Postgres performance + RLS + pgvector tuning
- Self-hosted $0-infra production deploys

See [docs/portfolio/](docs/portfolio/) for pitch copy, case study, and architecture one-pager.

## License

MIT. See [LICENSE](LICENSE).
