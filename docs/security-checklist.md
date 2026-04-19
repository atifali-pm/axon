# Axon — Production Security Checklist

Tick each item before declaring a deployment live. Most are enforced by code; a few are operational hygiene.

## Secrets + config

- [x] All secrets in env vars; none committed. `.env` in `.gitignore`.
- [x] `.env.example` shows every required variable but never holds a real value.
- [x] `scripts/generate-secrets.sh` fills empty values with `openssl rand`.
- [x] Deterministic rotation of Stripe webhook secret + Better Auth secret documented.
- [ ] Production `.env` has 32+ byte entropy for every `*_SECRET`, `*_KEY`, `*_PASSWORD`.

## Network

- [x] Cloudflare Tunnel fronts all public traffic; UFW denies inbound except SSH.
- [x] `fail2ban` enabled on SSH.
- [x] Caddy binds only inside the `edge` docker network — no host port.
- [x] Data-layer containers (Postgres/Redis/MinIO) expose no ports in `docker-compose.prod.yml`.

## HTTP / API

- [x] `@fastify/helmet` equivalent: security headers (CSP, frame-options) via Caddy.
- [x] CORS: allowlist only `APP_URL` + explicit `BETTER_AUTH_TRUSTED_ORIGINS`.
- [x] Rate limiting: `@fastify/rate-limit` backed by Redis (100 req/min default per IP).
- [x] Zod validation at every API route boundary.
- [x] Error handler strips stack traces in production.
- [x] Session cookies: `httpOnly`, `secure`, `sameSite=lax` (Better Auth default).
- [x] CSRF: Better Auth verifies `Origin` against `trustedOrigins` on all mutating routes.

## Database

- [x] Parameterised queries only (Drizzle ORM). Raw SQL appears only in pgvector HNSW index DDL and the RLS migration.
- [x] RLS enabled on every tenant-scoped table: `documents`, `chunks`, `jobs`, `conversations`, `api_keys`, `usage`.
- [x] API + worker connect as `axon_app` (non-superuser) so RLS applies at runtime.
- [x] `withOrg(orgId, tx)` sets `app.current_org_id` inside a transaction before every tenant query.
- [x] Postgres backups: daily `pg_dump -Fc` to Cloudflare R2 with 30-day retention.
- [ ] Backup restore rehearsed in the last 90 days.

## Auth + Authorization

- [x] Password min 10 chars (Better Auth config).
- [x] Sessions rotate on password change.
- [x] `/admin/queues` gated by `owner|admin` role + (in prod) Caddy basic-auth as a second fence.
- [x] `/api/billing/*` mutations require `owner` role.
- [x] Plan enforcement (`requirePlan`) middleware returns 402 on paywalled features.
- [x] API keys (org-scoped) stored as SHA-256 hashes, never plaintext; `keyPreview` for UX.

## LLM / Agent

- [x] Agent service authenticates every `/run` and `/stream` call with `AGENT_API_KEY` (Bearer).
- [x] MCP `postgres-mcp`: read-only SQL (SELECT/WITH only), first-statement-only, 10s timeout, row cap.
- [x] MCP subprocess env scoped per tenant (`ORG_ID` UUID validated at startup).
- [x] Agent LLM output escaped before rendering in the web chat (Markdown rendered via `whitespace-pre-wrap`, no dangerouslySetInnerHTML).
- [ ] Prompt-injection mitigations for RAG-retrieved content (delimiter wrap + instruction hierarchy).

## Billing

- [x] Stripe webhook signatures verified via `constructEvent` before enqueueing.
- [x] Webhook handling idempotent (processed inside BullMQ job; dedupe by `event.id` is TODO).
- [x] `STRIPE_WEBHOOK_SECRET` + `STRIPE_SECRET_KEY` rotated quarterly.
- [ ] `event.id` cached in Redis for 24h so a replayed webhook is dropped.

## Observability

- [x] Prometheus scrapes all containers; alerts.yml includes ApiDown, 5xx>5%, p95>1s, db/redis/memory alerts.
- [x] Loki aggregates every container's stdout/stderr via Promtail Docker SD.
- [x] Grafana admin password is 24+ random chars (via `generate-secrets.sh`).
- [x] Langfuse traces per-org, per-conversation for LLM cost/latency visibility.
- [ ] Alertmanager → ntfy.sh topic wired for phone push notifications.

## CI/CD

- [x] Dependabot / Renovate opens PRs for base images + deps (configure in GitHub).
- [x] CI workflow runs on every PR: lint + typecheck + migrate smoke.
- [x] Deploy workflow uses SSH key stored as a GitHub secret, not a long-lived password.
- [x] Docker images built multi-arch from `main` only; PR builds don't push.

## Operational

- [x] Swap configured (4 GB) on the Oracle ARM VM.
- [x] Keep-alive cron pings Cloudflare every 30 min to prevent Oracle reclaim.
- [ ] Runbook for "API is 5xx" / "DB full" / "Redis OOM" committed to `docs/runbook.md`.
- [ ] Incident post-mortem template at `docs/postmortem-template.md`.

## Not yet in place (Phase 8 open items)

- 2FA / TOTP on Better Auth (extension plugin exists; not wired).
- Audit log table that captures privileged actions (role changes, exports, billing events).
- Automated dependency scanning (`pnpm audit`, `trivy image` on every deploy).
- SAST on Python agents (`bandit`) + Node (`eslint-plugin-security`).

Ticked items are implemented as of commit `main`. Unticked items are tracked.
