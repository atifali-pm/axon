# Fiverr — Gig Description

Fiverr is package-led. Lead with outcomes and tiers, not architecture theory.

---

## Gig title (80 char max)

**I will build your AI agent SaaS with RAG, queues, mobile, and $0 deploy**

## Gig image caption / hero banner copy

PRODUCTION AI SAAS, NOT A TUTORIAL
Multi-tenant • LangGraph agents • RAG • Mobile • Stripe • $0/mo deploy

## Short description (shown on search)

I build production AI agent platforms with the architecture that actually holds in production. Postgres RLS for tenant isolation, BullMQ queue-first async, LangGraph agents with multi-LLM routing, per-tenant RAG on pgvector, Stripe billing, Android + iOS via Expo, Grafana + Langfuse observability, $0/mo deploy. Reference: github.com/atifali-pm/axon

## Long description

Most AI gigs deliver a thin wrapper around the OpenAI API. I deliver the **platform underneath**.

My reference codebase, **Axon**, is public on GitHub (MIT licence) and ships every layer a real AI product needs:

- **Multi-tenant with DB-level isolation.** Postgres Row-Level Security policies, not just `WHERE org_id = ?` filters. Forgetting a filter in application code still leaks zero rows.
- **Queue-first async.** Seven typed BullMQ queues. Your API never blocks on a slow LLM or a flaky webhook.
- **LangGraph agents + tool calling.** Python FastAPI service, streaming over SSE, multi-LLM router (Groq → Gemini → Claude → GPT → Ollama fallback chain) with automatic retry.
- **Per-tenant RAG on Postgres.** Ollama `nomic-embed-text` + pgvector HNSW + Postgres FTS hybrid search. Prompt-injection fences on retrieved chunks.
- **Mobile companion app.** Android + iOS via Expo SDK 52. Streaming chat, voice input via Groq Whisper, offline queue, push notifications, document upload.
- **Agent marketplace.** Shareable agent configs orgs can publish and fork into their workspace.
- **Stripe billing.** Checkout, portal, signed + deduped webhooks, plan-enforcement middleware.
- **Observability.** Prometheus + Grafana + Loki + Langfuse for LLM traces + Alertmanager → ntfy phone push.
- **$0/mo production.** Oracle Cloud Always Free ARM VM, Cloudflare Tunnel, Caddy auto-HTTPS, free LLM tiers. Your ops budget is a `.xyz` domain.

## Packages

**BASIC — $300**
Multi-tenant auth setup on your stack: Better Auth + orgs + RLS policies + one tenant-scoped resource + API middleware. One revision. 5 days.

**STANDARD — $900**
BASIC + BullMQ queue-first async + Bull Board + LangGraph agent service with tool calling + chat endpoint with SSE + Langfuse tracing. Delivered as a runnable monorepo. Two revisions. 10 days.

**PREMIUM — $2,500**
STANDARD + RAG pipeline (upload, chunk, embed, hybrid search) + Stripe billing + CI/CD + production deploy to Oracle Cloud + Cloudflare Tunnel + DNS + backups to Cloudflare R2. Includes a one-hour architecture call. Three revisions. 20 days.

## Add-ons

- **Mobile companion (Expo Android + iOS)** including push, voice, offline queue, store-ready build config: **$800**
- **Agent marketplace** (shareable templates + fork + marketplace feed): **$400**
- **Fine-tune loop** (thumbs + NDJSON export for LoRA): **$250**
- **MCP server for a specific integration** (GitHub, Stripe, your internal API): **$300 each**
- **Grafana + Prometheus + Loki + Langfuse stack**: **$500**
- **Cloudflare Tunnel + Caddy auto-HTTPS deploy to Oracle Cloud Always Free**: **$400**
- **1-hour architecture consultation + written recommendations**: **$150**

## Why me

I built Axon specifically because I was tired of SaaS tutorials that stop at "CRUD with auth." This is senior-architect work: the tenant isolation, the queue architecture, the observability wiring, the mobile layer, and the deploy path. Clients hire me because I've already made the mistakes on my own time.

## FAQ

**Q: Can I see it running before buying?**
A: Yes. The GitHub repo is public (github.com/atifali-pm/axon), and I send a 3-minute Loom of the app running end to end before we start.

**Q: Will you use my existing stack?**
A: Yes. Axon is a reference, not a dogmatic template. I adapt to Python-only, Go, Rails, Django, or anything else on the backend. The architecture patterns port cleanly.

**Q: Who owns the code?**
A: You do. MIT licence, full handoff, no retained rights.

**Q: Do the mobile builds actually ship to the stores?**
A: The code is ready. Play Store needs your $25 developer fee, Apple needs $99/yr, I handle the rest. Details in `apps/mobile/RELEASE.md`.

**Q: What if something breaks post-delivery?**
A: 30-day bug-fix window included. After that, I offer retainer support at a reduced rate.

**Q: I only need one layer, not the whole thing.**
A: Good. Scoped engagements are my favourite. See the add-ons above or message me to price a custom scope.
