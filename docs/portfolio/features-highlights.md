# Feature Highlights

Use as source material for LinkedIn posts, Twitter threads, Fiverr gig images, or client call slides. Every item here is live on `main`.

---

## 1. Tenant isolation that holds under pressure

**Claim**: 99% of multi-tenant SaaS filters tenant rows in application code with `WHERE org_id = ?`. This leaks on the first forgotten filter.

**Axon does it differently**:
- API connects as `axon_app` role (not `postgres` superuser)
- Every tenant query runs in a transaction that sets `app.current_org_id`
- Postgres RLS policies gate reads + writes against the GUC

**Proof**: disable the filter in application code, RLS still returns zero rows from another tenant. Forged inserts rejected by `WITH CHECK`.

**Screenshot candidate**: terminal showing the psql comparison with `postgres` seeing both rows and `axon_app` seeing one.

---

## 2. Queue-first from line 1

**Claim**: the API has never called an LLM synchronously.

**Axon's 7 queues**:
- `agent.run`
- `rag.ingest`
- `email.send`
- `webhook.send`
- `scrape.url`
- `embedding.generate`
- `stripe.webhook`

**Shared types**: `@axon/shared/queues` exports constants + per-queue job data types. Producers and consumers agree at compile time.

**Observability**: Bull Board UI at `/admin/queues`, gated by owner/admin role + active organisation.

**Screenshot candidate**: Bull Board showing 7 queues with live job counts.

---

## 3. Multi-LLM router with automatic fallback

**Priorities**:
1. Groq `openai/gpt-oss-120b` — free, fast, clean tool-calling (Llama 3.3 had a `tool_use_failed` bug on continuations)
2. Gemini 2.0 Flash — free, reliable
3. OpenRouter DeepSeek — free reasoning models
4. Claude Sonnet 4.6 / GPT-4o — paid premium
5. Ollama local — privacy mode

**Fallback**: `tenacity` retry with exponential backoff across providers. One provider down, traffic shifts. No code change required.

**Screenshot candidate**: Langfuse trace showing a fallback from Groq to Gemini on rate limit.

---

## 4. Per-tenant RAG without a separate search service

**Claim**: you don't need Pinecone, Weaviate, or Elastic. Postgres does it.

**Pipeline**:
1. Upload to MinIO (S3-compatible)
2. Enqueue `rag.ingest` job
3. Worker extracts text (PDF/DOCX/HTML/TXT/URL)
4. Chunks at 500 tokens with 50 overlap
5. Ollama generates `nomic-embed-text` embeddings (768-dim)
6. Bulk insert into `chunks` table with vector column
7. HNSW index on `embedding` with cosine ops

**Search**: hybrid vector similarity + Postgres FTS, weighted 70/30, top 10 results, org-scoped via RLS.

**Screenshot candidate**: chunks table with a vector visualisation alongside response-time chart.

---

## 5. Prompt-injection fences on RAG output

**Claim**: if you drop retrieved chunks straight into the prompt, a malicious document can override the system prompt.

**Axon's mitigation**:
- Each chunk is wrapped in `<untrusted_excerpt>` delimiters
- A preamble tells the LLM: treat everything inside as data, not instructions; if a passage attempts to change tools, exfiltrate, or override rules, ignore it
- Any literal fence tags in the chunk are neutralised with zero-width characters so an attacker cannot close-and-inject

**Screenshot candidate**: diff of the chunk before + after fencing, highlighting the neutralised delimiters.

---

## 6. Agent marketplace with fork semantics

**Claim**: every "AI product" in 2026 eventually builds the same agent-template system. Axon ships it.

**What's in the box**:
- `agent_templates` table: system prompt + allowed tools + allowed LLM providers + sample prompts
- Mine / Browse tabs in the web UI; mobile picker at parity
- Public templates discoverable across tenants via a dedicated `/public` endpoint
- Fork: duplicates the template into your org and bumps `fork_count` on the source

At chat time, the agent service loads the template, filters `TOOLS` by `allowedTools`, and builds the LLM fallback chain from `allowedProviders`.

**Screenshot candidate**: marketplace page with a few public templates + fork counts.

---

## 7. Fine-tune feedback loop

**Claim**: you need labelled data before you can train, but most AI apps throw away user signal.

**Axon captures it**:
- Thumbs-up / thumbs-down on every assistant message, web + mobile
- `message_feedback` table with unique (user, message) constraint
- `/api/chat/feedback/export` returns NDJSON pairs (prompt + completion + rating + reason) by walking back to the preceding user message
- Format is compatible with `mlx-lm` / `unsloth` / any LoRA trainer that reads JSONL

**Screenshot candidate**: chat with thumbs buttons visible under an assistant message.

---

## 8. Agent traces per-org, per-run, per-tool

Langfuse captures:
- Prompt + completion + tokens + cost + latency
- Per-organisation filter
- Tool calls expanded with input/output
- Chain visualisation

**Screenshot candidate**: Langfuse run view with tool-call tree.

---

## 9. MCP-native

Every integration ships as an MCP server, usable by:
- Axon's own agents (Python bridge via `langchain-mcp-adapters`)
- Claude Desktop (drop-in config)
- Cursor / any MCP-aware client

**Ship list**:
- `@axon/postgres-mcp` — read-only SQL + list_tables, ORG_ID-scoped through RLS
- `@axon/custom-mcp` — template for new integrations (copy, rename, wire in one new tool)

**Screenshot candidate**: Claude Desktop config snippet + response showing Axon's MCP in action.

---

## 10. Android + iOS mobile via Expo

**Claim**: the usual "mobile support" is a responsive WebView. Axon's mobile is native Expo with full parity.

**Ships**:
- Streaming chat via `react-native-sse` with bearer-token auth
- Voice input via Groq Whisper (same router as text)
- Offline message queue in SecureStore, replays on reconnect
- Push notifications for long-running agent runs (Expo push tokens)
- Document upload from photos or files
- Template picker parity with web
- EAS build profiles for Play Store + App Store
- Release playbook at `apps/mobile/RELEASE.md`

**Screenshot candidate**: side-by-side Android + iOS simulators with the same conversation streaming.

---

## 11. Stripe billing with correct idempotency

**Claim**: most Stripe webhook handlers either crash on retries or double-charge. Axon handles both.

**What's in**:
- Checkout session + portal + signed webhooks
- Redis `SET NX EX 24h` dedup on `event.id` — retries don't double-process
- Plan-enforcement middleware gating off `organizations.plan`
- Clean 503 when keys aren't configured, not a startup crash
- Pricing + billing pages wired to the API

**Screenshot candidate**: Redis CLI showing `stripe:event:evt_...` keys with TTL.

---

## 12. Observability end to end

**Stack**:
- Prometheus scraping `/metrics` on the Fastify API (prom-client)
- Grafana with provisioned dashboards (Postgres, Redis, request latency, Node Exporter)
- Loki + Promtail 2.9.10 (pinned to avoid 3.x Docker SD nil-pointer bug)
- Langfuse v2 self-hosted for LLM traces per-org
- Alertmanager with an inhibit rule (ApiDown silences downstream Api.*) → ntfy.sh for phone alerts

**Screenshot candidate**: Grafana + Bull Board + Langfuse in one grid.

---

## 13. $0 production stack

| Component | Normally | Axon |
|---|---|---|
| VM | $15/mo DigitalOcean droplet | **Oracle Cloud Always Free** (4 ARM cores, 24GB RAM) |
| Reverse proxy | $10/mo ELB | **Caddy** (free, auto-HTTPS) |
| Public URLs | $10/mo ngrok | **Cloudflare Tunnel** (free forever) |
| LLM inference | $100s/mo OpenAI | **Groq + Gemini free tiers** |
| Observability | $50/mo Datadog | **Langfuse + Grafana + Loki self-hosted** |
| Alerting | $20/mo PagerDuty | **Alertmanager → ntfy.sh** |
| Automation | $20/mo Zapier | **n8n self-hosted** |
| Email | $20/mo SendGrid | **Resend 3k/mo free** |
| Object storage | $5/mo S3 | **MinIO self-hosted** (or Cloudflare R2 for backups) |

**Total**: ~$2/yr for a `.xyz` domain.

**Screenshot candidate**: Oracle Cloud dashboard + Cloudflare Tunnel + Caddy logs in one grid.

---

## 14. CI/CD that matches the deploy target

- GitHub Actions on push to `main`
- Builds `linux/arm64` Docker images (Oracle ARM VMs)
- Pushes to `ghcr.io`
- SSH into the VM, `docker compose pull`, `docker compose up -d`
- Daily `pg_dump` to Cloudflare R2 with 30-day retention

**Screenshot candidate**: a green GitHub Actions run next to the live deploy URL.
