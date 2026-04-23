# Axon — Architecture One-Pager

Print this to PDF, attach to proposals, or drop into client calls.

---

## The shape

```
               +-----------------------------------+
               |   BROWSERS · MOBILE · MCP CLIENTS |
               +----+-----------+-----------+------+
                    |           |           |
     +--------------+           |           +--------------+
     |                          |                          |
     v                          v                          v
+-----------+          +-----------------+        +-------------------+
| Next.js   |          |   Fastify 5     |        |  MCP clients      |
| 15 web    |          |   API gateway   |        |  (Claude Desktop, |
| + SSR     |--------->|   + SSE stream  |        |   Cursor, agents) |
| chat,     |          |   + auth hooks  |        +-------------------+
| agents,   |          |   + /admin/*    |
| billing   |          +---+-----+----+--+
+-----------+              |     |    |
          +----------------+     |    +----------------+
          |                      |                     |
          v                      v                     v
+-----------------+     +-----------------+    +------------------+
| BullMQ workers  |     |  Python         |    |  MCP servers     |
| 7 typed queues  |---->|  LangGraph      |    |  @axon/postgres  |
| Bull Board      |     |  agents         |    |  @axon/custom    |
+--------+--------+     |  + FastAPI      |    +------------------+
         |              |  + multi-LLM    |
         |              |    router       |
         |              |  + MCP bridge   |
         |              +--------+--------+
         |                       |
         v                       v
+---------------------------------------------------------+
|   Postgres 16 + pgvector  |  Redis 7 (BullMQ + cache +  |
|   runtime RLS via         |                 webhook     |
|   axon_app role + GUC     |                 idempotency)|
+---------------------------------------------------------+
         |
         v
+------------------+     +------------------+
|  MinIO (S3)      |     |  Langfuse        |
|  object storage  |     |  LLM traces      |
+------------------+     +------------------+

Observability plane:  Prometheus · Grafana · Loki · Promtail 2.9.10
                      Alertmanager (inhibit rules)  ->  ntfy.sh

Mobile: Expo SDK 52 · React Native 0.76 · NativeWind
         bearer-token auth, SSE streaming, offline queue, push

Outbound LLMs: Groq (gpt-oss-120b) | Gemini | Claude | GPT | Ollama
Outbound infra: Stripe | Resend | Cloudflare R2 (backups)
```

## Key numbers

| | |
|---|---|
| Monorepo apps | 5 (web, api, worker, agents, mobile) |
| Monorepo packages | 6 (db, shared, ui, mcp-servers, postgres-mcp, custom-mcp) |
| Tenant-isolated tables | 8+ (documents, chunks, jobs, conversations, api_keys, usage, agent_templates, message_feedback, …) |
| BullMQ queues | 7 (typed end to end) |
| LLM providers supported | 6 (Groq, Gemini, OpenRouter, Claude, GPT, Ollama) |
| Production cost | $0 + optional ~$2/yr domain |
| Mobile targets | Android + iOS via Expo / EAS |

## Non-obvious decisions

1. **Tenant isolation at the DB, not in application code.** RLS policies + a non-superuser role + transactional GUC means a missing WHERE clause leaks nothing.
2. **Queue-first from day one.** No LLM call, email, scrape, or embed runs in an API handler.
3. **Python for agents, TypeScript for everything else.** Separate services, no shared runtime, no cold-start tax on the API.
4. **Drizzle + raw SQL for pgvector/RLS.** Type safety where it helps, raw SQL where it doesn't fight the tool.
5. **Better Auth over NextAuth.** Self-hostable, clean API, works cross-service and has a `bearer()` plugin so the mobile app uses the same auth surface as web.
6. **Prompt-injection fencing on RAG.** Retrieved chunks wrapped in `<untrusted_excerpt>` tags with delimiter neutralisation so a malicious upload cannot close-and-inject.
7. **Redis-backed Stripe webhook idempotency.** `SET NX EX 24h` on `event.id` makes retries safe.
8. **Persisted message IDs over SSE.** After streaming, the server emits `user_message` and `assistant_message` frames with DB IDs so thumbs-up/down feedback targets the right row on web and mobile.

## Surface area

### Public web

- `/` landing
- `/signup`, `/login`
- `/dashboard` (orgs)
- `/chat` (streaming, template picker, thumbs feedback)
- `/agents` (marketplace: Mine + Browse + Fork)
- `/pricing`, `/billing`
- `/api/auth/*` Better Auth catch-all

### API (`apps/api`)

- `GET /health`
- `GET /api/me` (auth required, returns user + active org)
- `POST /api/jobs`, `GET /api/jobs/:id`
- `POST /api/documents`, `GET /api/documents`
- `POST /api/chat` (SSE stream with `user_message` + `assistant_message` frames)
- `GET /api/chat/jobs/:id`
- `POST /api/chat/messages/:id/feedback`, `DELETE /api/chat/messages/:id/feedback`
- `GET /api/chat/feedback/export` (NDJSON)
- `GET /api/agents`, `GET /api/agents/public`, `POST /api/agents`, `PATCH /api/agents/:id`, `DELETE /api/agents/:id`, `POST /api/agents/:id/fork`
- `POST /api/billing/checkout`, `POST /api/billing/portal`, `POST /webhooks/stripe`
- `GET /metrics` (Prometheus)
- `/admin/queues` (owner/admin gated)

### Agents service (`apps/agents`)

- `GET /health`
- `POST /run` (sync agent run, internal auth)
- `POST /stream` (SSE, internal auth, template-aware)

### Mobile (`apps/mobile`)

- Streaming chat with template picker
- Voice input (Groq Whisper)
- Offline message queue (SecureStore)
- Push notifications (Expo)
- Document upload
- Thumbs-up/down feedback

## Data model highlights

- `organizations` is the tenant root. Every tenant-scoped table references `organization_id`.
- `chunks.embedding` is a 768-dim `vector` with an HNSW index using cosine distance.
- `jobs` mirrors BullMQ state for API-friendly polling: `pending → running → completed|failed|cancelled`.
- `sessions.active_organization_id` is where the user's current org selection lives.
- `agent_templates` carries the system prompt + allowed tools + allowed providers + sample prompts; unique per (org, slug); has `fork_count` and `forked_from_id`.
- `message_feedback` is unique per (user, message) and powers the NDJSON export for fine-tuning.

## Deploy topology

1 Oracle Cloud Always Free ARM VM (4 cores, 24 GB RAM). Docker Compose runs every container. Caddy handles auto-HTTPS for every subdomain. Cloudflare Tunnel gives public URLs without opening ports. GitHub Actions builds `linux/arm64` images on push to `main` and SSH-deploys. Daily `pg_dump` to Cloudflare R2 with 30-day retention. Alertmanager pushes outages to your phone via ntfy.

Mobile ships through EAS: builds on Expo's cloud, signed for Play Store + App Store, release playbook at `apps/mobile/RELEASE.md`.

## What a scoped engagement looks like

- **Phase 2 only** (auth + multi-tenant + RLS): 1 week, $2k-4k
- **Phase 3 only** (queue-first retrofit onto an existing app): 1 week, $2k-4k
- **Phase 4 only** (LangGraph agents + multi-LLM router): 2 weeks, $4k-8k
- **Phase 5 only** (RAG pipeline with prompt-injection fence): 2 weeks, $4k-8k
- **Phase 7 only** (full observability stack): 1-2 weeks, $2k-5k
- **Phase 9 only** (Expo Android + iOS companion app): 2-3 weeks, $4k-8k
- **Agent marketplace + fine-tune loop add-on**: 1 week, $2k-3k
- **Full Phase 1-9 build on your infra**: 8-10 weeks, $30k-60k

Ranges assume a stack I've worked with. Python-only / Go / Rails variants priced separately.

Repo: https://github.com/atifali-pm/axon
