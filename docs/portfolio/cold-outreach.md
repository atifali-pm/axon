# Cold Outreach

Cold outreach is where you pick the client instead of waiting for them to find you. The repo is your credibility. Email (or LinkedIn DM) is the delivery vehicle.

---

## Who to target

Go after **companies that just raised seed or Series A in the last 6 months** with an AI product in their pitch. They have budget, urgency, and no platform team yet. Find them via:

- Y Combinator launch posts
- Product Hunt launches in the AI category
- TechCrunch "raised" announcements
- Hacker News "Ask HN: who's hiring" threads
- LinkedIn people-search for "founding engineer" + "AI" + "San Francisco" / "New York" / "London"

Skip: enterprises with a platform team already (they won't fork your work). Skip: bootstrappers with no budget.

## Outreach email template

**Subject**: Production AI platform patterns you may want to steal

**Body**:

Hi [FIRST NAME],

Congrats on the [RAISE / LAUNCH / SHIP — pick one concrete thing]. I saw [SPECIFIC DETAIL from their public material — a feature, a job post, a blog post]. I've been heads-down on the same problem space for a year and just open-sourced my reference implementation: https://github.com/atifali-pm/axon

It ships the parts that usually get bolted on six months in:

• Multi-tenant isolation at the Postgres layer (RLS + non-superuser role + transactional GUC, not app-level filters)
• Queue-first async (BullMQ) so LLM calls never block the API
• LangGraph agents with a multi-LLM router (Groq → Gemini → Claude → GPT → Ollama)
• Per-tenant RAG on pgvector with prompt-injection fences
• Observability (Langfuse + Prometheus + Grafana + Loki)
• Android + iOS via Expo
• $0/mo production deploy on Oracle ARM + Cloudflare

If the patterns match what you're building, happy to do a free 30-minute architecture call — I'll walk you through the three failure modes I see most often and how to avoid them. If it's useful, we can talk about me folding parts of Axon into your codebase.

Either way, please fork / star the repo if you find it useful.

— Atif
[github.com/atifali-pm](https://github.com/atifali-pm)

---

## Subject-line variants

- Production AI platform patterns you may want to steal
- Saw [FEATURE]; we've been building the same thing
- 9 phases of AI SaaS infrastructure, MIT-licensed
- Open-sourced my AI platform reference; thought you'd want a look
- Before you hire another founding engineer

## Follow-up (7 days later, no reply)

Subject: Re: [original subject]

Hi [FIRST NAME], quick nudge. If the architecture in github.com/atifali-pm/axon is useful, the one-pager at docs/portfolio/architecture-one-pager.md is a 5-minute read.

If it's not the right fit, no worries — no further emails from me.

— Atif

## Follow-up (14 days later, still no reply)

Drop them. Do not send a third. Focus your outreach budget on fresh prospects.

## Volume + time budget

- **10 tailored emails per day** beats 100 copy-paste. Each one takes 5-10 minutes of research.
- **Monday morning block**: 30 new prospects researched + 10 emails sent.
- Expect ~2-5% reply rate. Of those, ~30% convert to a call. Of those, ~30% convert to an engagement.
- That's ~1 paid engagement per 300-500 emails over 2-3 months.

## What success looks like on a call

The call is NOT a sales pitch. Your job is to diagnose. Ask:

1. What's the scariest production incident you've had, or fear having?
2. Who writes your most-expensive LLM queries, and how do you know?
3. If a customer asked tomorrow to sign a DPA, how long to produce it?

If their answers reveal the 3 failure modes Axon solves (no RLS at DB, synchronous LLM calls, no observability), make the offer:

> "I can fix those three in 2-3 weeks. Here's the scope, here's the price. The repo shows you the patterns I'll use."

Closing rate on discovery calls that find real pain: ~30-50%.
