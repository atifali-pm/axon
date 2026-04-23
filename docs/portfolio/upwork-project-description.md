# Upwork — Portfolio Item

Paste into a new Upwork portfolio item.

---

## Title (70 char max)

**Axon — Production AI Agent SaaS (Multi-tenant + RAG + Mobile + Stripe)**

## Short description (1-2 lines shown in the list view)

Full-stack AI agent SaaS I built end to end. Multi-tenant with Postgres RLS, LangGraph agents, per-tenant RAG, Stripe billing, Android + iOS mobile, $0/mo production stack. MIT open source.

## Full description

Axon is my reference implementation for what a production AI platform looks like in 2026. It ships every layer a real product needs, not just the parts every tutorial covers.

**Architecture highlights**

- **Multi-tenant with DB-level isolation.** The API connects as a non-superuser Postgres role. Every tenant-scoped query runs inside a transaction that sets `app.current_org_id` via `set_config`, and RLS policies gate reads and writes. Forgetting a `WHERE` clause in application code still leaks zero rows. Demonstrable in the repo.
- **Queue-first async from day one.** Seven typed BullMQ queues. The API never calls an LLM, sends an email, or scrapes the web inline. Everything is a job with retries and Bull Board visibility.
- **LangGraph agents + multi-LLM router.** State machine with tool calling, streaming via SSE, automatic fallback across Groq → Gemini → OpenRouter → Claude → OpenAI → Ollama. Template marketplace lets orgs publish and fork agent configurations.
- **Per-tenant RAG on Postgres.** Ollama `nomic-embed-text` embeddings, HNSW index, hybrid vector + Postgres FTS search weighted 70/30. Prompt-injection fences wrap retrieved chunks so an attacker-uploaded document can't override the system prompt.
- **MCP-native integrations.** Custom `@axon/postgres-mcp` server + template for new ones. Agents load MCP tools per tenant. Works with Claude Desktop too.
- **Stripe billing + plan enforcement.** Checkout, customer portal, signed webhooks with Redis-backed idempotency, plan-limit middleware. Graceful degradation when keys aren't configured.
- **Android + iOS via Expo.** Full parity with web: streaming chat with bearer auth, voice input via Groq Whisper, offline message queue that replays on reconnect, push notifications for long-running agent runs, document upload.
- **Observability end to end.** Prometheus, Grafana with provisioned dashboards, Loki + Promtail, Langfuse for LLM traces per org, Alertmanager → ntfy phone alerts.
- **$0/mo production**: Oracle Cloud Always Free ARM VM, Cloudflare Tunnel, Caddy auto-HTTPS, Ollama + Groq + Gemini free tiers, Langfuse self-hosted. GitHub Actions builds linux/arm64 multi-arch images, pushes to GHCR, SSH-deploys.

**What I deliver to clients**

I fork Axon into your codebase or stack, rebrand, and ship. I can do it end to end or pick one layer (auth + RLS, queue system, RAG, agents, mobile, observability, billing, deploy) as a scoped engagement. You walk away with working code, not just specs.

**Repo**: https://github.com/atifali-pm/axon (public, MIT, 22 commits, 10 workspace packages, complete commit history showing the 9-phase build).

## Skills tags

TypeScript, Node.js, Next.js, React, React Native, Expo, Tailwind CSS, Fastify, Python, FastAPI, LangGraph, LangChain, BullMQ, Redis, PostgreSQL, pgvector, Drizzle ORM, Docker, Docker Compose, Multi-tenant SaaS, Row-Level Security, Authentication, Better Auth, Stripe, OpenAI API, Anthropic API, Groq, Gemini, Retrieval-Augmented Generation, RAG, Vector Database, AI Agents, MCP, Model Context Protocol, SaaS Architecture, DevOps, CI/CD, GitHub Actions, Cloudflare, Caddy, Observability, Grafana, Prometheus, Loki, Langfuse, Self-Hosting, Oracle Cloud, Mobile Development, iOS, Android, Expo EAS, Push Notifications, WebSockets, SSE, Streaming

## Role + duration

- **Role**: Solo full-stack architect + engineer
- **Duration**: 9 phases across ~1 week
- **Status**: Feature-complete. Only external-cred-gated items remain (real deploy + store submission, both documented playbooks in the repo).
- **Licence**: MIT
