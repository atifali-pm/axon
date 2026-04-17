# Upwork — Portfolio Item

Copy/paste into a new Upwork portfolio item. Use the title, description, and skills tags below.

---

## Title (70 char max)

**Axon — Multi-Tenant AI Agent SaaS Platform (LangGraph, RAG, MCP)**

## Short description (1-2 lines shown in list)

Production-grade AI agent SaaS with per-tenant RAG, queue-first async, multi-LLM routing, and $0 deploy. Built end-to-end: Next.js + Fastify + Python + Postgres/pgvector.

## Full description

Axon is a production-grade platform for AI agent SaaS, built as a reference architecture for modern agentic applications. It ships every layer that real AI products need, not the tutorial version.

**What I built**

- Multi-tenant auth with per-organization isolation enforced at the database via Postgres Row-Level Security (runtime-enforced; the app connects as a non-superuser role and every tenant query sets the org GUC inside a transaction)
- Queue-first architecture: every LLM call, embedding, scrape, email, and webhook runs through BullMQ. 7 typed queues, 7 processors, Bull Board admin UI gated by role
- Per-tenant RAG pipeline: document upload → MinIO → chunk (token-aware) → Ollama embeddings → pgvector HNSW index → hybrid vector + Postgres FTS search with 70/30 weighting
- LangGraph agents (Python + FastAPI) with tool calling, streaming responses over SSE, multi-provider LLM router (Groq → Gemini → OpenRouter → Claude/GPT → Ollama) with automatic fallback
- MCP servers for Postgres, GitHub, and Stripe — usable by Axon agents AND external clients like Claude Desktop
- Observability: Langfuse for LLM traces (per-org breakdown of tokens, latency, cost), Prometheus + Grafana + Loki for infra, ntfy.sh alerts
- $0 production stack: Oracle Cloud Always Free ARM VM + Cloudflare Tunnel + Caddy auto-HTTPS, CI/CD via GitHub Actions building linux/arm64 images

**Architecture**

pnpm + Turborepo monorepo across 4 apps (web / api / worker / agents) and 4 packages (db / shared / ui / mcp-servers). TypeScript for all Node services, Python 3.12 for agents only. Drizzle ORM for schema + migrations, Zod for validation at every boundary, Better Auth for session management.

**What makes it different**

Most SaaS tutorials stop at "filter by org_id in every query." Axon enforces tenant isolation at the Postgres level. Drop the where clause in application code, RLS still returns zero cross-tenant rows. Forged writes are rejected by the policy's WITH CHECK clause.

**Repository**: https://github.com/atifali-pm/axon (public, MIT licensed)

**Stack**: Next.js 15, React 19, Tailwind, Fastify 5, Python 3.12, LangGraph, BullMQ 5, Postgres 16, pgvector, Drizzle ORM, Better Auth, Langfuse, Caddy, Cloudflare Tunnel, Oracle Cloud

## Skills tags (paste into Skills section)

TypeScript, Node.js, Next.js, React, Tailwind CSS, Fastify, Python, FastAPI, LangGraph, LangChain, BullMQ, Redis, PostgreSQL, pgvector, Drizzle ORM, Docker, Docker Compose, Multi-tenant SaaS, Authentication, Stripe, OpenAI API, Anthropic API, Groq, Retrieval-Augmented Generation, RAG, Vector Database, AI Agents, MCP, Model Context Protocol, Microservices, SaaS Architecture, DevOps, CI/CD, GitHub Actions, Cloudflare, Caddy, Observability, Grafana, Prometheus, Self-Hosting

## Duration / role

- **Role**: Solo full-stack architect + engineer
- **Duration**: 8 phases, roughly one week per phase for a full-time solo build
- **Status**: Phases 1-3 shipped and live, phases 4-8 on the roadmap
