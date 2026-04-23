# Axon — Portfolio Pack

Ready-to-paste pitch copy, platform-specific listings, and long-form material for every job-posting and social surface. Each file is self-contained and can be dropped into the target platform with minimal edits.

---

## Shared pitch kit (mix-and-match)

- [pitch-kit.md](pitch-kit.md) — atomic pieces: headlines, one-liners, elevator, proof bullets, tech stack, CTAs, anti-claims, links block
- [architecture-one-pager.md](architecture-one-pager.md) — printable architecture, API surface, data-model highlights, engagement pricing
- [features-highlights.md](features-highlights.md) — 14 feature callouts with screenshot suggestions
- [case-study.md](case-study.md) — long-form article (~10 min read), suitable for blog / LinkedIn article / dev.to / Substack

## Freelance marketplaces

- [upwork-project-description.md](upwork-project-description.md) — paste into your Upwork Portfolio item
- [upwork-proposal-template.md](upwork-proposal-template.md) — reply template for "build me an AI SaaS" jobs (with MVP / fix-existing / mobile variants)
- [fiverr-gig-description.md](fiverr-gig-description.md) — gig title, description, 3 packages (Basic / Standard / Premium), add-ons, FAQ
- [contra.md](contra.md) — profile headline + bio + 8 priced services + featured project
- [toptal-arc.md](toptal-arc.md) — per-platform application strategy for Toptal / Arc / Braintrust / Gun.io / A.Team, plus rate-anchoring table

## Social and community

- [linkedin.md](linkedin.md) — headline, 2,000-char About, Featured section, launch + deep-dive + offer post templates, cadence
- [social-posts.md](social-posts.md) — Show HN post, 9-tweet Twitter thread, Product Hunt launch, Reddit targets (SideProject / Entrepreneur / selfhosted / LocalLLaMA / devops), IndieHackers retro, 2-week posting schedule

## Direct outreach

- [cold-outreach.md](cold-outreach.md) — target audiences, email template, subject-line variants, 7-day + 14-day follow-ups, volume math, discovery-call playbook

---

## How to use

1. **Capture screenshots**: `pnpm screenshots` from the repo root (generates PNGs in `docs/images/`).
2. **Start with the pitch kit**: any platform's body can be built from `pitch-kit.md` + proof bullets.
3. **Pick one platform at a time**: each file has a ready-to-paste version; rotate the angle per platform, never cross-post identical copy.
4. **Use the architecture one-pager** in client calls and attach it to proposals.
5. **Point every listing back to the repo**: `https://github.com/atifali-pm/axon`.

## Launch sequence (first 2 weeks)

| Day | Channel | File |
|---|---|---|
| 1 | Hacker News (Show HN) | [social-posts.md](social-posts.md) |
| 2 | Twitter / X thread | [social-posts.md](social-posts.md) |
| 3 | LinkedIn launch post | [linkedin.md](linkedin.md) |
| 4 | Product Hunt launch | [social-posts.md](social-posts.md) |
| 5 | r/SideProject | [social-posts.md](social-posts.md) |
| 7 | IndieHackers retro | [social-posts.md](social-posts.md) |
| 10 | r/selfhosted | [social-posts.md](social-posts.md) |
| 14 | r/LocalLLaMA | [social-posts.md](social-posts.md) |

In parallel with the launch sequence: refresh Upwork + Fiverr + Contra + LinkedIn Featured with the Axon copy, and start a 10-email-per-day cold outreach rhythm using the template in [cold-outreach.md](cold-outreach.md).

## Positioning

This is the project that proves you can build **production AI platforms**, not just glue APIs together. The talking points:

- **Not a tutorial app.** 10-package monorepo, runtime RLS, queue-first architecture, multi-LLM routing, MCP integrations, mobile parity, agent marketplace, fine-tune loop, prompt-injection fences, Stripe idempotency. The stuff that takes teams 6 months to get right.
- **Cost-conscious.** $0/month production stack. Matters to every bootstrap founder.
- **Ships in phases.** Each phase is demonstrable on its own. Clients can hire for a single phase (RAG, agents, mobile, observability) or the whole thing.
- **Opinionated.** No synchronous LLM calls, no application-level tenant filters, no untyped queue payloads, no WebView mobile.

## Golden anti-claims (build trust before clients ask)

- Not a tutorial. Full commit history on `main`, 9 phases + post-launch roadmap, every layer built from scratch and verified end to end.
- Not a wrapper. Groq, Gemini, Claude, GPT, Ollama all in the router with automatic fallback.
- Not a naive multi-tenant app. Tenant isolation enforced in Postgres via RLS + non-superuser role + transactional GUC.
- Not built for vapourware. Runs locally in 30 seconds, runs in Expo Go, runs on a $0 Oracle ARM VM.
