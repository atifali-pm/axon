# Axon — Portfolio Pack

Ready-to-paste marketing copy, pitch decks in markdown, and visuals for Upwork, Fiverr, LinkedIn, and cold outreach.

## Contents

- [upwork-project-description.md](upwork-project-description.md) — paste into your Upwork "Portfolio" item
- [upwork-proposal-template.md](upwork-proposal-template.md) — response template for "build me an AI SaaS" jobs
- [fiverr-gig-description.md](fiverr-gig-description.md) — paste into your Fiverr gig
- [case-study.md](case-study.md) — long-form article, suitable for blog / LinkedIn post
- [architecture-one-pager.md](architecture-one-pager.md) — printable architecture for client calls
- [features-highlights.md](features-highlights.md) — feature-by-feature callouts with metrics

## How to use

1. Capture screenshots: `pnpm screenshots` from the repo root (generates PNGs in `docs/images/`)
2. Upload screenshots to Upwork/Fiverr alongside the copy from the `.md` files
3. On Upwork, attach the GitHub repo link under "Portfolio details"
4. On Fiverr, use the architecture one-pager as the gig banner

## Positioning

This is the project that proves you can build **production AI platforms**, not just glue together APIs. The talking points:

- **Not a tutorial app.** 14-table schema, runtime RLS, queue-first architecture, multi-LLM routing, MCP integrations — the stuff that takes teams 6 months to get right.
- **Cost-conscious.** $0/month production stack. Matters to every bootstrap founder.
- **Ships in phases.** Each phase is demonstrable on its own. Clients can hire you for a single phase (RAG, agents, observability) or the whole thing.
- **Opinionated.** No JSX in backend, no raw SQL where Drizzle works, no synchronous LLM calls, no untyped queue payloads.
