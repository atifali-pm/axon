# Upwork Proposal Template

Use when bidding on "build me an AI SaaS / agent platform / RAG chat" jobs. Swap bracketed bits. Keep it tight — clients skim.

---

## Opener (first 2 lines visible in the job list)

Hi [NAME], I've built exactly this: a multi-tenant AI agent SaaS with per-tenant RAG, queue-first async, and Postgres RLS. Open-source reference at https://github.com/atifali-pm/axon — happy to walk you through it.

## Middle

I noticed [ONE SPECIFIC DETAIL FROM THEIR JOB POST, e.g. "you mentioned hybrid search with FTS+vectors"]. That's exactly the pattern Axon uses: pgvector HNSW index + Postgres FTS, weighted 70/30, single SQL query, no separate search infra needed.

**What I'd deliver for this scope**:
- [Specific thing from their post]
- [Specific thing from their post]
- [Specific thing from their post]
- Clean handoff: README, architecture docs, one-pager, CI/CD, deploy scripts

**Proven track record** (see GitHub for proofs):
- Multi-tenant SaaS with database-level tenant isolation (Postgres RLS, not just app-level filters)
- Queue-first Node backends (BullMQ) so LLM calls, embeddings, and webhooks never block the API
- Multi-LLM routing (Groq → Gemini → Claude fallback) with Langfuse tracing per org
- $0 production deploys (Oracle Cloud + Cloudflare Tunnel + Caddy)

## Close

If useful, I can send a 3-minute Loom of the platform running locally. What's your timeline, and is the stack flexible (TS + Python) or fixed?

—Atif

---

## Variant: "I need a quick MVP" jobs

Skip the architecture detail. Lead with speed:

> I have a prod-ready AI SaaS reference (https://github.com/atifali-pm/axon) I can fork into your MVP. Signup + orgs + billing + agent chat in 1 week, not 6. Happy to scope exactly what you need on a 15-min call.

## Variant: "Fix my existing AI app" jobs

Lead with diagnosis:

> Before bidding, I'd want to look at three things in your repo: 1) is tenant isolation enforced at the DB or only in application code, 2) are LLM calls synchronous or queued, 3) is there any LLM observability wired up. Those are the three mistakes I fix most often. Happy to do a free 20-min audit — send the repo or walk me through on a call.

## Rate anchoring

For US/EU clients, anchor at **$65-95/hr** or **$3k-8k/phase** fixed.
For APAC/MENA, anchor at **$35-55/hr** or **$1.5k-4k/phase**.
Axon is a senior-architect-level portfolio, not a junior-engineer artifact. Price accordingly.
