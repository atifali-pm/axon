# Upwork Proposal Template

Customise the bracketed bits. Keep it tight; clients skim. Lead with proof, end with a concrete next step.

---

## Opener (the first 150 characters show in the job-list preview)

Hi [NAME]. I've built exactly this: a multi-tenant AI agent SaaS with per-tenant RAG, Stripe billing, mobile, and $0/mo deploy. Open source at https://github.com/atifali-pm/axon.

## Body (follows the opener after the "see more" click)

I noticed [ONE SPECIFIC LINE from their post, e.g. "you want hybrid search with FTS + vectors" or "streaming chat with tool calling"]. Axon uses that exact pattern: Postgres pgvector HNSW + FTS weighted 70/30 in a single SQL query, no external search service required.

**What I'd deliver for this scope**

- [Specific deliverable from their post, restated in your own words]
- [Second deliverable]
- [Third deliverable]
- Handoff includes: README, architecture doc, security checklist, CI/CD, deploy scripts

**Proven patterns (see repo for receipts)**

- Multi-tenant SaaS with database-level isolation (Postgres RLS + non-superuser role + transactional GUC, not just app-level filters)
- Queue-first Node backends (BullMQ) so LLM calls, embeddings, and webhooks never block the API
- Multi-LLM router with automatic fallback (Groq → Gemini → Claude) and Langfuse tracing per org
- RAG on Postgres with prompt-injection fences
- Mobile: Expo SDK 52, streaming chat, voice input, offline queue, push notifications
- $0/mo production (Oracle Cloud + Cloudflare Tunnel + Caddy)

**Close**

I can send a 3-minute Loom of Axon running end to end if useful. What's your timeline, and is the stack flexible (TS + Python) or fixed?

— Atif

---

## Variant: tight MVP jobs

> I have a production-ready AI SaaS reference (https://github.com/atifali-pm/axon) I fork into client projects. Signup + orgs + RLS + chat + billing + mobile in 1-2 weeks instead of 6. Happy to scope yours on a 15-min call.

## Variant: "fix my existing AI app"

> Before bidding, I'd look at three things: 1) is tenant isolation enforced at the DB or only in application code, 2) are LLM calls synchronous or queued, 3) is there any LLM observability. Those are the three mistakes I fix most often. Happy to do a free 20-min audit — send the repo or walk me through on a call.

## Variant: "add mobile to our existing SaaS"

> I built the mobile half of my own SaaS (apps/mobile/ in https://github.com/atifali-pm/axon): Expo SDK 52 + React Native 0.76, bearer-token auth against a Fastify API, SSE streaming chat, voice input via Groq Whisper, offline message queue, push notifications, EAS builds to Play + App Store. Happy to bring the same to your product.

## Rate anchoring

- **US / EU**: $65-95/hr or $3k-8k per scoped phase (auth, queues, RAG, agents, mobile, observability, billing, deploy)
- **APAC / MENA / Latam**: $35-55/hr or $1.5k-4k per phase
- **Full platform rebuild** (fork Axon + rebrand + deploy): $25k-50k

You are pitching senior-architect work. The public repo is the justification for the rate.
