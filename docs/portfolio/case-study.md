# Case Study — Axon: Production AI Agent SaaS on $0/month

**Audience**: Engineering leaders considering an AI product. Founders comparing build-vs-buy. Other senior engineers.
**Length**: ~8 min read. Suitable for Substack, dev.to, LinkedIn article, or blog.

---

## The problem

Every "build an AI SaaS" tutorial stops at the same place: an OpenAI wrapper, a basic auth screen, a text box. None of them ship the parts that actually break in production:

- **Tenant isolation that holds when a junior forgets a WHERE clause**
- **Async work that doesn't make your API stall on a 30-second GPT-4 call**
- **Observability that shows you *which org* is burning tokens on *which agent run***
- **A deploy path that doesn't cost $500/month on AWS before you have users**

I built Axon to be the reference codebase that covers all four — and that I could use as a portfolio artifact for client work.

## Constraints

- **$0/month recurring** (optional ~$2/year for a `.xyz` domain)
- **Self-hostable** — no vendor lock-in, no proprietary services
- **Production patterns from day one** — not "we'll add that later"
- **Multi-LLM** — platform, not provider-dependent

## Architecture decisions

### 1. Tenant isolation at the database, not the application

Most multi-tenant SaaS tutorials rely on `WHERE org_id = ?` in every query. This is fragile: one missing clause leaks rows.

Axon enforces isolation at the Postgres level:

- The API connects as `axon_app` (a non-superuser role), not `postgres`
- Every tenant-scoped query runs inside a transaction that sets `app.current_org_id` via `set_config(..., true)`
- RLS policies on `documents`, `chunks`, `jobs`, `conversations`, `api_keys`, and `usage` gate reads **and writes** against that GUC

Demonstrable: dropping the WHERE clause in application code still returns zero cross-tenant rows. Forged inserts fail with `new row violates row-level security policy`.

### 2. Queue-first, not queue-maybe

The API never calls an LLM inline. Every chat request creates a `jobs` row, enqueues to BullMQ, and returns a `jobId` the client polls (or streams via SSE from the agent service directly).

Why: LLM providers regularly take 5-30 seconds. Email providers rate-limit. Web scraping fails and retries. Doing any of this synchronously inside a Fastify request handler is how you get 504s in production.

Seven typed queues from day one: `agent.run`, `rag.ingest`, `email.send`, `webhook.send`, `scrape.url`, `embedding.generate`, `stripe.webhook`. Each has a strictly typed payload shared between the API (producer) and the worker (consumer) via `@axon/shared/queues`.

### 3. LangGraph agents in their own service

Node has a perfectly good LangChain port. I used Python anyway. Why:

- The Python AI ecosystem is 3-6 months ahead on every feature that matters (LangGraph, DSPy, new model SDKs)
- LangGraph's state-machine-for-agents model is a better fit than ReAct loops for anything non-trivial
- Keeping agents in a separate service means the Node API doesn't inherit Python's cold-start tax

The Node API calls the Python agent service over HTTP (sync mode) or enqueues a `agent.run` job that the worker picks up and forwards (async mode). SSE streaming flows Python → Node → browser without buffering.

### 4. Multi-LLM router with free-tier primaries

Default stack:
- **Primary**: Groq Llama 3.3 70B (free, 500 TPM, fast inference)
- **Fallback**: Gemini 2.0 Flash (free tier generous)
- **Reasoning**: OpenRouter's free DeepSeek/Llama
- **Premium**: Claude Sonnet 4.6 / GPT-4o (gate on paid plans)
- **Privacy**: Ollama local (opt-in for enterprise)

`get_llm(provider=...)` + a `tenacity` retry with exponential backoff across providers. Your product keeps running when Groq rate-limits you.

### 5. Observability from day one, not "later"

Langfuse self-hosted captures every LLM call: model, prompt, response, tokens, cost, latency, org ID. Infra side: Prometheus scrapes `/metrics` from Fastify, Loki ships logs from all containers, Grafana dashboards for Postgres, Redis, and request latency.

Alerts via ntfy.sh (free, push to phone). No PagerDuty bill.

## What shipped

- **Phase 1**: monorepo + Docker data layer + 4 app shells. ~30 min to boot from clean clone.
- **Phase 2**: Drizzle schema (14 tables), Better Auth with org plugin, API tenant middleware, Postgres RLS runtime-enforced.
- **Phase 3**: BullMQ queues, worker processors, Bull Board admin UI.
- **Phases 4-8**: agents, RAG, MCP, observability, deploy. Roadmap on GitHub.

## Unusual patterns worth stealing

**`withOrg(orgId, tx => ...)` helper**: one-liner at the callsite, transactional GUC set, RLS applies automatically. Replaces every "remember to filter by org_id" code review comment.

**Shared queue types across services**: `@axon/shared/queues` exports constants + per-queue job data types. TypeScript catches mismatches between producer and consumer at compile time.

**Two Postgres roles, one DB**: `postgres` for migrations and admin tasks (bypasses RLS), `axon_app` for runtime (RLS applies). Same database, different blast radius.

## What I'd change next time

- Move `verifications` + `accounts` tables to Better Auth's exact shape from day one instead of reconciling mid-Phase-2
- Use `uv` for Python from the start instead of `pip` + venv
- Add a `scripts/bootstrap.sh` that covers everything from `cp .env.example` to `pnpm dev` in one command

## Takeaways

- Tenant isolation is a DB problem, not an application problem
- Async is not an optimization, it is the architecture
- Multi-LLM routing is not over-engineering, it is survival
- $0/month production is a real target if you design for it

**Code**: https://github.com/atifali-pm/axon
**Contact**: Atif Ali, available on Upwork and Fiverr for similar builds
