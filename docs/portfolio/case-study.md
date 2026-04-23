# Case Study — Axon: Production AI Agent SaaS on $0/month

**Audience**: Engineering leaders considering an AI product. Founders comparing build-vs-buy. Other senior engineers.
**Length**: ~10 min read. Suitable for Substack, dev.to, LinkedIn article, or blog.

---

## The problem

Every "build an AI SaaS" tutorial stops at the same place: an OpenAI wrapper, a basic auth screen, a text box. None of them ship the parts that actually break in production:

- **Tenant isolation that holds when a junior forgets a WHERE clause**
- **Async work that doesn't make your API stall on a 30-second GPT-4 call**
- **Observability that shows you *which org* is burning tokens on *which agent run***
- **A deploy path that doesn't cost $500/month on AWS before you have users**
- **A mobile app that has real parity with the web, not a WebView**
- **Defences against the stuff that will bite in production: prompt injection, duplicate Stripe webhooks, provider outages**

I built Axon to be the reference codebase that covers all of it, and that I could use as a portfolio artefact for client work. It is open-source, MIT-licensed, and feature-complete on `main`.

## Constraints

- **$0/month recurring** (optional ~$2/year for a `.xyz` domain)
- **Self-hostable** — no vendor lock-in, no proprietary services
- **Production patterns from day one** — not "we'll add that later"
- **Multi-LLM** — platform, not provider-dependent
- **Mobile + web parity** — native Android + iOS, not a mobile-web wrapper

## Architecture decisions

### 1. Tenant isolation at the database, not the application

Most multi-tenant SaaS tutorials rely on `WHERE org_id = ?` in every query. This is fragile; one missing clause leaks rows.

Axon enforces isolation at the Postgres level:

- The API connects as `axon_app` (a non-superuser role), not `postgres`
- Every tenant-scoped query runs inside a transaction that sets `app.current_org_id` via `set_config(..., true)`
- RLS policies on `documents`, `chunks`, `jobs`, `conversations`, `api_keys`, `usage`, `agent_templates`, and `message_feedback` gate reads **and writes** against that GUC

Demonstrable: dropping the WHERE clause in application code still returns zero cross-tenant rows. Forged inserts fail with `new row violates row-level security policy`.

One helper wraps the pattern:

```ts
await withOrg(req.organization.id, async (tx) => {
  return tx.insert(documents).values({ ... });
});
```

### 2. Queue-first, not queue-maybe

The API never calls an LLM inline. Every chat request creates a `jobs` row, enqueues to BullMQ, and the worker forwards to the Python agent service, which streams back over SSE.

Why: LLM providers regularly take 5-30 seconds. Email providers rate-limit. Web scraping fails and retries. Doing any of this synchronously inside a Fastify request handler is how you get 504s in production.

Seven typed queues from day one: `agent.run`, `rag.ingest`, `email.send`, `webhook.send`, `scrape.url`, `embedding.generate`, `stripe.webhook`. Each has a strictly-typed payload shared between the API (producer) and the worker (consumer) via `@axon/shared/queues`.

### 3. LangGraph agents in their own service

Node has a perfectly good LangChain port. I used Python anyway. Why:

- The Python AI ecosystem is 3-6 months ahead on every feature that matters (LangGraph, DSPy, new model SDKs)
- LangGraph's state-machine-for-agents model is a better fit than ReAct loops for anything non-trivial
- Keeping agents in a separate service means the Node API doesn't inherit Python's cold-start tax

The Node API calls the Python agent service over HTTP (sync mode) or enqueues a `agent.run` job that the worker picks up and forwards (async mode). SSE streaming flows Python → Node → browser (or mobile) without buffering.

### 4. Multi-LLM router with free-tier primaries

Default stack:
- **Primary**: Groq `openai/gpt-oss-120b` (free, fast inference; Llama 3.3 hit a `tool_use_failed` bug on continuation turns, gpt-oss-120b does not)
- **Fallback**: Gemini 2.0 Flash (free tier generous)
- **Reasoning**: OpenRouter's free DeepSeek
- **Premium**: Claude Sonnet 4.6 / GPT-4o (gate on paid plans)
- **Privacy**: Ollama local (opt-in for enterprise)

`get_llm(provider=...)` + a `tenacity` retry with exponential backoff across providers. Your product keeps running when Groq rate-limits you.

### 5. Per-tenant RAG with a prompt-injection defence

Retrieved chunks go through a prompt-injection fence before they land in the LLM context. Every chunk is wrapped in `<untrusted_excerpt>` delimiters with an explicit instruction to the model to treat the content as data, not directives. Any literal fence tags in the chunk are neutralised with zero-width characters so a malicious upload cannot close the fence and inject its own directives.

Hybrid search: vector similarity (pgvector HNSW, cosine) + Postgres full-text search, weighted 70/30 in a single SQL, scoped through the `axon_app` role so a RAG query cannot leak across tenants.

### 6. Agent marketplace and fine-tune loop

Two features that most tutorials skip but real products need:

- **Agent marketplace**: orgs publish `agent_templates` (system prompt + allowed tools + allowed LLM providers + sample prompts). Anyone with access can fork a public template into their own workspace. At chat time, the agent service loads the template, filters the tool list, and builds the LLM fallback chain from the allowed-providers list.
- **Fine-tune loop**: every assistant message has a thumbs-up / thumbs-down button. Feedback is stored in `message_feedback` (unique per user + message). An admin endpoint exports the feedback as NDJSON pairs (prompt + completion + rating + reason) ready to pipe into a LoRA training run.

Both features exist on web and on mobile at parity.

### 7. Observability from day one, not "later"

Langfuse self-hosted captures every LLM call: model, prompt, response, tokens, cost, latency, org ID. Infra side: Prometheus scrapes `/metrics` from Fastify, Loki ships logs from all containers (Promtail pinned at `2.9.10` because `3.x` has a Docker service-discovery nil-pointer), Grafana dashboards for Postgres, Redis, and request latency.

Alertmanager routes fires to ntfy.sh (free, push-to-phone) with an inhibit rule so that an `ApiDown` alert silences downstream `Api.*` alerts to prevent notification storms. No PagerDuty bill.

### 8. Mobile without WebViews

Android + iOS via Expo SDK 52 and React Native 0.76. Full parity with the web client:

- Streaming chat via `react-native-sse` with bearer-token auth (Better Auth `bearer()` plugin)
- Voice input via Groq Whisper (same router as text)
- Offline message queue in SecureStore that replays on reconnect
- Push notifications for long-running agent runs (Expo push tokens)
- Document upload from photos or files
- Template picker parity with web

EAS build profiles ready for Play Store + App Store. Release playbook at `apps/mobile/RELEASE.md`.

### 9. Stripe billing with correct idempotency

Every Stripe webhook is fenced through a Redis `SET NX EX 24h` on the event ID. Retries from Stripe never double-charge or double-update. Plan-enforcement middleware gates features off the `organizations.plan` column. The API returns 503 cleanly when Stripe keys aren't configured rather than crashing at startup.

## What shipped

All 9 phases on `main`, plus the post-launch roadmap:

| Phase | Ships |
|---|---|
| 1 | Monorepo + Docker infra + 4 app shells |
| 2 | Drizzle schema, Better Auth with org plugin, API tenant middleware, Postgres RLS runtime-enforced |
| 3 | BullMQ queues, worker processors, Bull Board admin UI |
| 4 | LangGraph agents, multi-LLM router, streaming SSE chat |
| 5 | RAG pipeline: upload → chunk → embed → pgvector HNSW + FTS hybrid search |
| 6 | MCP: `@axon/postgres-mcp`, `@axon/custom-mcp`, Python bridge via `langchain-mcp-adapters` |
| 7 | Observability: Prometheus + Grafana + Loki + Langfuse + Alertmanager → ntfy |
| 8 | Stripe billing + plan enforcement + CI/CD linux/arm64 → GHCR → Oracle VM deploy scripts |
| 9 | Expo SDK 52 mobile app: streaming chat, voice, offline queue, push, template picker, EAS build config |
| + | Agent marketplace, fine-tune feedback loop, prompt-injection fence, Stripe webhook idempotency |

## Unusual patterns worth stealing

**`withOrg(orgId, tx => ...)` helper**: one-liner at the callsite, transactional GUC set, RLS applies automatically. Replaces every "remember to filter by org_id" code review comment.

**Shared queue types across services**: `@axon/shared/queues` exports constants + per-queue job data types. TypeScript catches mismatches between producer and consumer at compile time.

**Two Postgres roles, one DB**: `postgres` for migrations and admin tasks (bypasses RLS), `axon_app` for runtime (RLS applies). Same database, different blast radius.

**Prompt-injection fences with delimiter neutralisation**: wrap untrusted RAG content in `<untrusted_excerpt>` tags with an explicit instruction to the model, and replace any literal fence strings inside the chunk with zero-width-separated variants so the attacker cannot close and inject.

**SSE with persisted message IDs**: after streaming an assistant message, the server emits `user_message` and `assistant_message` frames with database IDs before `[DONE]`. The client uses these to attach thumbs-up/down feedback to the right row. Works identically on web and mobile.

**Bearer-token auth for mobile**: Better Auth's `bearer()` plugin lets the mobile app sign in with email + password, store the token in SecureStore, and call the same API that the web cookie-session uses. No separate mobile API surface.

## What I'd change next time

- Move `verifications` + `accounts` tables to Better Auth's exact shape from day one instead of reconciling mid-Phase-2
- Use `uv` for Python from the start instead of `pip` + venv
- Add a `scripts/bootstrap.sh` that covers everything from `cp .env.example` to `pnpm dev` in one command

## Takeaways

- Tenant isolation is a DB problem, not an application problem
- Async is not an optimisation, it is the architecture
- Multi-LLM routing is not over-engineering, it is survival
- Prompt injection is a real vulnerability, not a theoretical one
- Mobile parity costs less than you think when the SSE contract is stable
- $0/month production is a real target if you design for it

**Code**: https://github.com/atifali-pm/axon
**Contact**: Atif Ali, available for engagements on Upwork, Fiverr, Contra, LinkedIn, or direct email.
