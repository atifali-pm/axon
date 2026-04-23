# Social Posts (Show HN, Twitter/X, Product Hunt, Reddit)

Different platforms, different shapes. Same underlying story. All link back to the repo.

---

## Hacker News — Show HN

HN rewards substance and punishes marketing. Keep it technical. One post per repo. Post on a Tuesday-Thursday morning, US time.

**Title** (80 chars max, HN strict about format):

> Show HN: Axon – Open-source reference for a production AI agent SaaS

**Body** (500-1000 words is fine on HN):

Hi HN,

I spent the last month building Axon, an open-source reference codebase for a production AI agent SaaS. It's the platform I wish had existed when I started my last project. Repo: https://github.com/atifali-pm/axon (MIT).

The motivation: most "build an AI SaaS" tutorials stop at a chat box wrapped around OpenAI. The parts that actually break in production — tenant isolation, queue-first async, multi-LLM fallback, observability — get added six months later. I wanted a single codebase that ships all of it, opinionated, from day one.

What's in it:

1. **Multi-tenant Postgres with RLS enforced at runtime.** The API connects as a non-superuser role (`axon_app`). Every tenant-scoped query runs inside a transaction that sets `app.current_org_id` via `set_config(..., true)`. Row-Level Security policies on tenant tables gate reads and writes against that setting. Dropping the `WHERE` clause in application code still returns zero cross-tenant rows; forged inserts get rejected by policy `WITH CHECK`. Helper: `withOrg(orgId, tx => ...)`.

2. **Queue-first architecture.** Seven typed BullMQ queues (`agent.run`, `rag.ingest`, `email.send`, `webhook.send`, `scrape.url`, `embedding.generate`, `stripe.webhook`). Shared producer/consumer types in `@axon/shared/queues`. The API never calls an LLM, sends an email, or scrapes inline.

3. **LangGraph agents + multi-LLM router.** State machine with tool calling, streaming via SSE. Router picks the provider: `openai/gpt-oss-120b` on Groq as primary (Llama 3.3 has a known `tool_use_failed` quirk on continuation turns), Gemini / Claude / GPT / Ollama as fallbacks. Template marketplace lets orgs publish and fork agent configs (system prompt + allowed tools + allowed providers).

4. **Per-tenant RAG.** Ollama `nomic-embed-text` embeddings, pgvector HNSW cosine index, hybrid vector + Postgres FTS search weighted 70/30 in a single SQL. Prompt-injection fences wrap retrieved chunks in `<untrusted_excerpt>` delimiters with explicit instructions to the LLM to treat enclosed text as data, not directives.

5. **MCP-native.** Custom `postgres-mcp` server (read-only SQL, ORG_ID-scoped via RLS), `custom-mcp` template. Python agents load MCP tools per tenant via `langchain-mcp-adapters`. Also wired for Claude Desktop.

6. **Stripe billing.** Checkout, portal, signed webhooks with Redis-backed idempotency (`SET NX EX 24h` on `event.id`), plan-enforcement middleware. Graceful 503 when keys aren't configured.

7. **Observability.** Prometheus scraping a prom-client `/metrics` on the Fastify API, Grafana with provisioned dashboards, Loki + Promtail for container logs (Promtail 2.9.10 pinned because 3.x has a nil-pointer in Docker SD), Langfuse v2 self-hosted for LLM traces per-org, Alertmanager → ntfy.sh for phone alerts.

8. **Android + iOS via Expo SDK 52.** Full parity with web: streaming chat via `react-native-sse` with bearer-token auth, voice input via Groq Whisper, offline message queue in SecureStore that replays on reconnect, push notifications for long-running agent runs, document upload. EAS build profiles for Play Store + App Store.

9. **$0/mo production target.** Oracle Cloud Always Free ARM VM (4 cores, 24 GB RAM), Cloudflare Tunnel, Caddy auto-HTTPS, Groq + Gemini free tiers, Langfuse + MinIO self-hosted. GitHub Actions builds linux/arm64 multi-arch images, pushes to GHCR, SSH-deploys. Daily `pg_dump` → Cloudflare R2 with 30-day retention.

Code stats: 10 workspace packages (pnpm + Turborepo), 22 commits visible on main, full phase-by-phase commit history, `pnpm -r typecheck` clean across web/api/worker/mobile/packages.

I'm happy to answer any technical questions here. Also open to engagements if the patterns map to something you're building.

**Happy to discuss**:
- The RLS + GUC pattern vs. app-level filters (with reproducible example)
- Why Groq over OpenAI for agent loops (latency + free tier)
- Why Postgres for vectors vs. a dedicated vector DB
- The MCP bridge pattern for Python agents calling Node MCP servers
- The `$0/mo production` target — which parts are genuinely free vs. "free with gotchas"

---

## Twitter / X thread

**Tweet 1** (hook):

> Spent the last month building Axon: an open-source reference for production AI agent SaaS.
>
> Not a tutorial. Not a wrapper. 9 phases of real work.
>
> 🧵 what's in it

**Tweet 2** (tenant isolation):

> 1/ Multi-tenant Postgres, but done the right way.
>
> The API connects as a non-superuser role. Every tenant query runs inside a transaction that sets `app.current_org_id`. RLS gates reads AND writes.
>
> Drop the WHERE clause: still zero leaks.

**Tweet 3** (queues):

> 2/ Queue-first from line 1.
>
> 7 typed BullMQ queues. The API never waits on an LLM, never sends email inline, never scrapes on the hot path.
>
> Shared TypeScript types across producer + consumer so both sides agree at compile time.

**Tweet 4** (agents):

> 3/ LangGraph agents with real tool calling.
>
> Multi-LLM router: Groq → Gemini → Claude → GPT → Ollama. Automatic fallback.
>
> + agent marketplace: orgs publish agent configs (prompt + allowed tools + allowed providers), others fork.

**Tweet 5** (RAG):

> 4/ Per-tenant RAG on Postgres, no Pinecone needed.
>
> pgvector HNSW + Postgres FTS hybrid search, weighted 70/30. Scoped via RLS through the whole path.
>
> Retrieved chunks wrapped in <untrusted_excerpt> fences so a malicious upload can't override the system prompt.

**Tweet 6** (mobile):

> 5/ Android + iOS via Expo.
>
> Streaming chat (react-native-sse), voice input via Groq Whisper, offline queue that replays on reconnect, push notifications for long agent runs.

**Tweet 7** (observability):

> 6/ Observability end to end.
>
> Prometheus + Grafana + Loki + Langfuse + Alertmanager → ntfy.
>
> Every LLM call traced, every queue job visible, your phone buzzes if the API goes down.

**Tweet 8** (cost):

> 7/ Production for ~$0/mo.
>
> Oracle Cloud Always Free ARM VM (4 cores, 24 GB). Cloudflare Tunnel. Caddy. Groq + Gemini free tiers. Langfuse self-hosted.
>
> Only recurring cost: ~$2/yr for a .xyz domain.

**Tweet 9** (call to action):

> MIT licence. Full commit history. 22 commits. Feature-complete.
>
> Fork it, steal the patterns, or hire me to adapt it to your stack.
>
> 🔗 github.com/atifali-pm/axon

---

## Product Hunt launch

Product Hunt loves polish and visuals more than technical depth. Reuse Axon screenshots as the gallery (6 images from `docs/images/`).

**Tagline** (60 chars):

> Production AI agent SaaS, open source. Fork and ship.

**Description** (260 chars):

> Axon is a production-grade reference for AI agent SaaS. Multi-tenant with Postgres RLS, LangGraph agents, per-tenant RAG on pgvector, Android + iOS via Expo, Stripe, full observability, $0/mo deploy. MIT licensed.

**First comment** (launches need a strong first comment from the maker):

> Hey Product Hunt 👋
>
> I'm Atif. I built Axon because I was tired of AI SaaS tutorials that stop at "chat with your docs" and leave the hard parts (tenant isolation, queues, observability, deploy) as an exercise for the reader.
>
> Axon ships all of those in one codebase. 9 phases, 22 commits, MIT licensed.
>
> A few things I'd love feedback on:
> 1. The multi-tenant RLS pattern — I enforce org isolation at the Postgres level via a non-superuser role + transactional GUC. Drop the WHERE clause in application code, still zero cross-tenant rows. Does this match what teams are doing in 2026?
> 2. The multi-LLM fallback chain — Groq is primary, Gemini + Claude + GPT as fallbacks. Happy to explain the routing logic.
> 3. The $0/mo production target — Oracle Cloud Always Free + Cloudflare Tunnel. Does the path hold up at scale?
>
> Happy to answer questions. And yes, I freelance — if the patterns match what you're building, DM me.

---

## Reddit posts

Target subs (in priority):

1. **r/SideProject** — friendly, project-oriented. Use the Show HN body, shorter.
2. **r/Entrepreneur** — reframe as "built an AI platform to resell to clients". Focus on the freelance angle.
3. **r/selfhosted** — emphasise the $0/mo deploy + Ollama + Langfuse self-hosting story.
4. **r/LocalLLaMA** — highlight Ollama integration, multi-LLM routing, the ability to run privacy-mode.
5. **r/devops** — focus on the CI/CD, multi-arch builds, Cloudflare Tunnel, observability stack.

One post per sub per week. Rotate the angle per sub. Never cross-post the same text.

**Generic Reddit template**:

> Title: Built and open-sourced a production AI agent SaaS reference codebase (9 phases, MIT)
>
> [BODY: take 2-3 paragraphs from Show HN post most relevant to the sub, add one sentence specific to that sub's audience]
>
> Repo: https://github.com/atifali-pm/axon

---

## IndieHackers post

IndieHackers rewards building-in-public stories. Write it as a retrospective:

**Title**: I open-sourced the AI SaaS platform I wish had existed a year ago

**Body**: reuse the "Motivation" + proof bullets from `pitch-kit.md`, plus a paragraph about the freelance business model (fork Axon into client projects).

---

## Posting schedule (first 2 weeks)

- **Day 1**: Show HN (Tuesday 8am PT).
- **Day 2**: Twitter thread.
- **Day 3**: LinkedIn launch post.
- **Day 4**: Product Hunt launch (Wednesday 12:01am PT).
- **Day 5**: r/SideProject.
- **Day 7**: IndieHackers retro.
- **Day 10**: r/selfhosted (different angle).
- **Day 14**: r/LocalLLaMA (different angle again).

Don't blast all at once. Each platform gets one shot; failure is fine, saturation is fatal.
