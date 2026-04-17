# Feature Highlights

Use as source material for LinkedIn posts, Twitter threads, Fiverr gig images, or client call slides.

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

**Observability**: Bull Board UI at `/admin/queues`, gated by owner/admin role.

**Screenshot candidate**: Bull Board showing 7 queues with live job counts.

---

## 3. Multi-LLM router with automatic fallback

**Priorities**:
1. Groq Llama 3.3 70B — free, fast
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
5. Ollama generates `nomic-embed-text` embeddings
6. Bulk insert into `chunks` table (vector(768))
7. HNSW index on `embedding` with cosine ops

**Search**: hybrid vector similarity + Postgres FTS, weighted 70/30, top 10 results, org-scoped via RLS.

**Screenshot candidate**: chunks table with a vector visualization alongside response-time chart.

---

## 5. Agent traces per-org, per-run, per-tool

Langfuse captures:
- Prompt + completion + tokens + cost + latency
- Per-organization filter
- Tool calls expanded with input/output
- Chain visualization

**Screenshot candidate**: Langfuse run view with tool-call tree.

---

## 6. MCP-native

Every integration ships as an MCP server, usable by:
- Axon's own agents (via HTTP/stdio bridge)
- Claude Desktop (drop-in config)
- Cursor / any MCP-aware client

**Ship list**:
- `postgres-mcp` — read-only SQL + list_tables
- `github-mcp` — list repos, search code, create issues
- `stripe-mcp` — customers, invoices, subscriptions
- `custom-mcp` — template for new integrations

**Screenshot candidate**: Claude Desktop config snippet + response showing Axon's MCP in action.

---

## 7. $0 production stack

| Component | Normally | Axon |
|---|---|---|
| VM | $15/mo DigitalOcean droplet | **Oracle Cloud Always Free** (4 ARM cores, 24GB RAM) |
| Reverse proxy | $10/mo ELB | **Caddy** (free, auto-HTTPS) |
| Public URLs | $10/mo ngrok | **Cloudflare Tunnel** (free forever) |
| LLM inference | $100s/mo OpenAI | **Groq + Gemini free tiers** |
| Observability | $50/mo Datadog | **Langfuse + Grafana + Loki self-hosted** |
| Automation | $20/mo Zapier | **n8n self-hosted** |
| Email | $20/mo SendGrid | **Resend 3k/mo free** |
| Object storage | $5/mo S3 | **MinIO self-hosted** |

**Total**: ~$2/yr for a `.xyz` domain.

**Screenshot candidate**: Oracle Cloud dashboard + Cloudflare Tunnel + Caddy logs in one grid.

---

## 8. CI/CD that matches the deploy target

- GitHub Actions on push to `main`
- Builds `linux/arm64` Docker images (Oracle ARM VMs)
- Pushes to `ghcr.io`
- SSH into the VM, `docker compose pull`, `docker compose up -d`

**Screenshot candidate**: a green GitHub Actions run next to the live deploy URL.
