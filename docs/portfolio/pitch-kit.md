# Axon — Pitch Kit

Atomic, copy-paste pieces. Mix and match across platforms. Every sentence here reflects the final state of the codebase on `main`.

---

## Headlines (70 chars)

- Production-grade AI agent SaaS. Full-stack, multi-tenant, $0 deploy.
- I built Axon so your AI product ships in weeks, not quarters.
- Multi-tenant AI platform: chat, RAG, agents, mobile, billing — done right.
- Not an OpenAI wrapper. A real AI SaaS platform you can fork and ship.

## One-liners (160 chars, Twitter / Fiverr short desc / Upwork short line)

- Axon is a production-ready AI agent SaaS: multi-tenant RAG, LangGraph agents, Stripe, observability, Android + iOS, runs on $0/mo infrastructure.
- I built and open-sourced the full stack for a modern AI SaaS. Clients fork and ship in weeks instead of reinventing the platform layer.
- Axon: 14-table Postgres schema with runtime RLS, 7 BullMQ queues, LangGraph agents, RAG via pgvector, Expo mobile app, Stripe, CI/CD. MIT.

## Elevator (~300 chars)

I built Axon, an open-source reference platform for AI agent SaaS. It ships every layer a real product needs: Postgres Row-Level Security enforced at runtime, queue-first async, LangGraph agents with multi-LLM routing, per-tenant RAG on pgvector, MCP integrations, Android + iOS via Expo, Stripe billing, Langfuse + Prometheus observability, and a $0/mo production path on Oracle Cloud + Cloudflare. I hire out to adapt this to your stack or build a specific layer end to end.

## Proof bullets (mix 3-5 for any listing)

- **14-table Postgres schema** with runtime Row-Level Security (the `axon_app` role + transactional GUC pattern, not naive `WHERE org_id =` filters)
- **7 typed BullMQ queues** with shared producer/consumer types across the workspace
- **LangGraph agents** with tool calling, streaming via SSE, multi-LLM router (Groq → Gemini → Claude → GPT → Ollama fallback chain)
- **Per-tenant RAG** on Postgres pgvector (HNSW + hybrid FTS) with runtime org scoping and prompt-injection fences
- **MCP servers** for Postgres + GitHub plus a custom-server template; safety rails (read-only postgres, write-gated github), agents load them as tools per tenant
- **Stripe billing** with webhook idempotency in Redis + plan-enforcement middleware + pricing + billing pages
- **Observability**: Prometheus + Grafana + Loki + Langfuse + Alertmanager → ntfy, all self-hosted
- **Mobile** (Expo SDK 52): native chat with streaming, voice input via Groq Whisper, offline message queue, push notifications, document upload
- **Agent marketplace**: shareable agent templates orgs can publish and fork
- **Fine-tune loop**: thumbs-up/down on every assistant message, NDJSON export ready for LoRA training
- **$0/mo production stack**: Oracle Cloud Always Free ARM VM + Cloudflare Tunnel + Caddy + CI/CD to GHCR
- **Production hygiene**: 30-day Postgres backups to Cloudflare R2, security checklist, privacy policy, CI with integration smoke, linux/arm64 multi-arch images
- **End-to-end seed + smoke** (`scripts/seed-demo.ts`): drives the real stack — signup, org, templates, chat with real LLM round-trip, rating, NDJSON export, cross-tenant isolation probe — in one command

## Tech stack (tagline)

TypeScript · Next.js 15 · React 19 · Fastify 5 · Python 3.12 · LangGraph · BullMQ · Postgres 16 · pgvector · Drizzle ORM · Better Auth · Stripe · Expo / React Native 0.76 · NativeWind · Docker · Caddy · Cloudflare Tunnel · Prometheus · Grafana · Loki · Langfuse · Ollama · Groq · Gemini

## Tech stack (badged markdown for GitHub-flavoured bios)

```
TypeScript • Python 3.12 • Next.js 15 • React 19 • Fastify 5 • LangGraph • BullMQ • Postgres 16+pgvector • Drizzle ORM • Better Auth • Expo / React Native 0.76 • Stripe • Ollama • Groq • Prometheus • Grafana • Loki • Langfuse • Caddy • Cloudflare Tunnel
```

## What-you-get bullets (for paid listings)

- A monorepo that boots in 30 seconds from clean clone to running stack
- Database schema, auth, RLS, queues, agents, RAG, billing, observability, mobile — all already wired
- Production Dockerfiles (linux/arm64), docker-compose.prod.yml, GitHub Actions deploy to GHCR
- Full documentation: architecture one-pager, security checklist, privacy policy, release playbook
- One live mobile app (Android + iOS via Expo) with push, voice, offline queue
- Source on public GitHub; MIT licence; I help you fork and rebrand

## Positioning statements (use as tagline slides / cover photos)

- "Most 'AI SaaS' projects stop at a chat box. Axon ships the platform underneath."
- "Built the platform so my clients don't have to."
- "9 phases. 1 codebase. $0 production cost. MIT."

## Call-to-action closers

- Repo: https://github.com/atifali-pm/axon. Open an issue or DM to scope an engagement.
- Fork it yourself or hire me to adapt it to your stack. Either way, you save ~6 months.
- 30-minute architecture call is free. Send me the repo you want integrated and I'll tell you where Axon patterns plug in.

## Anti-claims (use to create trust)

- Not a tutorial project. Not a fork of a hello-world starter. The commit log tells the full story: 22 commits, 9 phases, every layer built from scratch and verified end to end.
- Not a wrapper around one API. Groq, Gemini, Claude, GPT, Ollama all live in the router with automatic fallback.
- Not a naive multi-tenant app. Tenant isolation is enforced at the database by Postgres RLS with a non-superuser role and transactional GUC. Drop the `where` clause in application code and the DB still returns zero cross-tenant rows.
- Not built for vapourware. Runs locally in Expo Go, runs on a $0 Oracle ARM VM, handles real production concerns.

## Links block (use verbatim in bios)

```
GitHub: https://github.com/atifali-pm/axon
Architecture: https://github.com/atifali-pm/axon/blob/main/docs/portfolio/architecture-one-pager.md
Case study: https://github.com/atifali-pm/axon/blob/main/docs/portfolio/case-study.md
Security checklist: https://github.com/atifali-pm/axon/blob/main/docs/security-checklist.md
Release playbook: https://github.com/atifali-pm/axon/blob/main/apps/mobile/RELEASE.md
```
