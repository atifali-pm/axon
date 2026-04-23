# Toptal / Arc / Braintrust / Gun.io

These are vetted platforms for senior freelancers. Rates are higher, but acceptance is gatekept by screening tests + portfolio review. Axon is the portfolio you need.

---

## Application strategy

**Do not apply to all of them at once.** Pick one and put real effort in:

- **Toptal** — the most selective, the longest screening (system-design interview + coding challenge + 2-week trial project). Rates: $60-150/hr+. Best for long engagements with enterprise clients. Apply only if you can invest 2-3 weeks in the interview process.
- **Arc.dev** — lighter screening, faster acceptance, strong for remote full-time contracts. Rates: $40-120/hr. Good first stop.
- **Braintrust** — no-fee marketplace with a BTRST token incentive. Acceptance is portfolio-based, not interview-based. Axon's public repo carries this application.
- **Gun.io** — US-market-focused, heavily vetted, enterprise contracts. Applications need a strong GitHub.
- **A.Team** — AI-focused, teams of senior freelancers form around client projects. Great if you enjoy peer collaboration.

## Portfolio entry (Toptal + Arc + Gun.io share this shape)

**Project**: Axon — Production AI Agent SaaS
**Role**: Solo founder, architect, and engineer
**Duration**: ~1 week (full-time intensive build)
**Repo**: https://github.com/atifali-pm/axon (public, MIT)

**Problem**: Most AI SaaS products stall at the same three problems in production: tenant isolation leaks, synchronous LLM calls time out the API, and there's no observability into which org or which prompt is burning tokens.

**What I built**: A 10-package monorepo covering every layer of an AI agent SaaS.

**Technical highlights**:

1. Runtime Postgres Row-Level Security via a non-superuser `axon_app` role + transactional GUC set at the start of every tenant-scoped request. Dropping the `where` clause leaks zero rows.
2. Queue-first architecture: seven typed BullMQ queues with shared producer/consumer types across the workspace. The API never waits on an LLM.
3. LangGraph agents with multi-LLM router (Groq → Gemini → Claude → GPT → Ollama fallback chain), streaming via SSE, template marketplace with fork semantics.
4. Per-tenant RAG on Postgres pgvector (HNSW cosine) + Postgres FTS hybrid search weighted 70/30. Prompt-injection fences via delimited untrusted-content blocks.
5. MCP-native integrations. Custom postgres-mcp server + template for others; agents load per-tenant.
6. Stripe billing with signed webhooks, Redis-backed idempotency, plan-enforcement middleware.
7. Android + iOS via Expo SDK 52: streaming chat, voice input (Groq Whisper), offline message queue, push notifications.
8. Full observability stack: Prometheus, Grafana with provisioned dashboards, Loki + Promtail, Langfuse for LLM traces, Alertmanager → ntfy phone alerts.
9. Production deploy: linux/arm64 multi-arch images via GitHub Actions, deploy to Oracle Cloud Always Free + Cloudflare Tunnel + Caddy. ~$0.17/mo total cost.

**Stack**: TypeScript (Next.js 15, Fastify 5, Drizzle ORM, BullMQ), Python 3.12 (FastAPI, LangGraph, asyncpg), PostgreSQL 16 with pgvector, Redis 7, MinIO, Ollama, Expo / React Native 0.76, Docker, Caddy, Cloudflare Tunnel.

**Outcome**: Feature-complete platform. 22 commits visible on main. Deploy and store submission are the only remaining steps, both blocked on external credentials (Oracle VM, Stripe, Apple Developer, Google Play).

## How to position for each platform

**Toptal**: lead with system-design depth. The interviewer wants to see that you can reason about trade-offs. The RLS runtime model + queue-first decision + multi-LLM fallback chain are three great stories to rehearse.

**Arc**: lead with the remote-work fit. "Built this solo, full-stack, end to end, shipped in a week." They value speed and breadth.

**Braintrust**: the portfolio does the talking. Put the repo front and centre, attach the architecture one-pager, list the 9 phases as separate skills tags.

**Gun.io**: US-market, vetted. Emphasise the production deployment path ($0/mo on Oracle + Cloudflare) and the security checklist — those signal that you think about operational concerns, not just features.

**A.Team**: emphasise cross-functional reach. You shipped frontend, backend, agents, mobile, DevOps, and docs yourself. They form small teams around projects; you're the one they'd call to own the platform layer.

## Rate anchoring per platform

| Platform | Starting hourly | Per-phase fixed | Full platform rebuild |
|---|---|---|---|
| Toptal (US clients) | $90-125 | $5-10k | $40-75k |
| Arc | $70-100 | $4-8k | $30-55k |
| Braintrust | $80-110 | $4-9k | $30-60k |
| Gun.io | $90-130 | $5-10k | $40-70k |
| A.Team | $90-130 (team lead premium) | N/A | N/A |

Do not go below $60/hr on any of these — the screening premium is the whole point of being there.
