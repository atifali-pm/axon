# Axon — Architecture One-Pager

Print this to PDF, attach to proposals, or drop into client calls.

---

## The shape

```
                   +-----------------------+
                   |   BROWSER / CLIENTS    |
                   +-----+-----+-----+-----+
                         |     |     |
        +----------------+     |     +----------------+
        |                      |                      |
        v                      v                      v
+---------------+     +---------------+     +------------------+
|   Next.js     |     |   Fastify 5   |     |  MCP clients     |
|   web + SSR   |     |   API gateway |     |  (Claude Desktop)|
|   /login      |---->|   /api/chat   |     +------------------+
|   /dashboard  |     |   /api/me     |
+---------------+     |   /admin/*    |
                      +-+-----+-----+-+
                        |     |     |
         +--------------+     |     +--------------+
         |                    |                    |
         v                    v                    v
+----------------+    +---------------+    +---------------+
|  BullMQ        |    |  Python       |    |  MCP servers  |
|  7 queues      |--->|  LangGraph    |    |  (postgres,   |
|  + workers     |    |  agents       |    |   github,     |
|  + Bull Board  |    |  + FastAPI    |    |   stripe)     |
+------+---------+    +-------+-------+    +---------------+
       |                      |
       v                      v
+-------------------------------------------------+
|     Postgres 16 + pgvector    |    Redis 7     |
|     RLS per-tenant (axon_app) |    BullMQ+cache|
+-------------------------------------------------+
       |
       v
+------------------+    +-------------------+
|  MinIO (S3)      |    |  Langfuse         |
|  object storage  |    |  LLM traces       |
+------------------+    +-------------------+

Outbound: Groq | Gemini | Claude | GPT | Ollama | Stripe | Resend
```

## Key numbers

| | |
|---|---|
| Monorepo apps | 4 (web, api, worker, agents) |
| Monorepo packages | 4 (db, shared, ui, mcp-servers) |
| Tenant-isolated tables | 6 (documents, chunks, jobs, conversations, api_keys, usage) |
| BullMQ queues | 7 (typed end to end) |
| LLM providers supported | 6 (Groq, Gemini, OpenRouter, Claude, GPT, Ollama) |
| Production cost | $0 + domain |
| Required cores to run | 1 (agents service optional) |

## Non-obvious decisions

1. **Tenant isolation at the DB, not in application code.** RLS policies + a non-superuser role + transactional GUC means a missing WHERE clause leaks nothing.
2. **Queue-first from day one.** No LLM call, email, scrape, or embed runs in an API handler.
3. **Python for agents, TypeScript for everything else.** Separate services, no shared runtime, no cold-start tax on the API.
4. **Drizzle + raw SQL for pgvector/RLS.** Type safety where it helps, raw SQL where it doesn't fight the tool.
5. **Better Auth over NextAuth.** Self-hostable, clean API, works cross-service (web issues cookies, API verifies them via `getSession`).

## Surface area

### Public

- `/` landing
- `/signup`, `/login`
- `/dashboard` (orgs)
- `/chat` (Phase 4)
- `/api/auth/*` Better Auth catch-all

### API

- `GET /health`
- `GET /api/me` (requires auth, returns user + active org)
- `POST /api/jobs`, `GET /api/jobs/:id`
- `POST /api/documents`, `GET /api/documents` (Phase 5)
- `POST /api/chat`, `GET /api/chat/jobs/:id` (Phase 4)
- `POST /api/billing/checkout`, `POST /webhooks/stripe` (Phase 8)
- `/admin/queues` (owner/admin gated)

### Agents service (Phase 4)

- `GET /health`
- `POST /run` (sync agent run, internal auth)
- `POST /stream` (SSE, internal auth)

## Data model highlights

- `organizations` is the tenant root. Every tenant-scoped table references `organization_id`.
- `chunks.embedding` is a 768-dim `vector` with an HNSW index using cosine distance.
- `jobs` mirrors BullMQ state for API-friendly polling: `pending → running → completed|failed|cancelled`.
- `sessions.active_organization_id` is where the user's current org selection lives.

## Deploy topology

1 Oracle Cloud Always Free ARM VM (4 cores, 24GB RAM). Docker Compose runs every container. Caddy handles auto-HTTPS for every subdomain. Cloudflare Tunnel gives public URLs without opening ports. GitHub Actions builds linux/arm64 images on push and SSH-deploys.

## What a 1-phase engagement looks like

- **Phase 2 only** (auth + multi-tenant + RLS): 1 week, $2k-4k
- **Phase 3 only** (queue system retrofit onto an existing app): 1 week, $2k-4k
- **Phase 4 only** (add LangGraph agents to an existing stack): 2 weeks, $4k-8k
- **Phase 5 only** (bolt-on RAG pipeline): 2 weeks, $4k-8k
- **Full Phase 1-8 build on your infra**: 6-8 weeks, $25k-50k

Ranges assume a stack I've worked with. Python-only / Go / Rails variants priced separately.
