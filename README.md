# Axon

AI-powered agentic SaaS platform. Multi-tenant, queue-first, MCP-native.

See `CLAUDE.md` for architecture, conventions, and the 8-phase build plan.
See `docs/end_to_end_saas_blueprint.md` for the full implementation reference.

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable`)
- Python 3.12+
- Docker + Docker Compose

## Local Dev Quickstart

```bash
# 1. Generate secrets (patches .env in place; re-runnable)
cp .env.example .env
./scripts/generate-secrets.sh

# 2. Start data layer
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 3. Install deps
pnpm install

# 4. Start all services (web, api, worker, agents)
pnpm dev
```

## Access Points

| Service | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| Agents | http://localhost:8000 |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |
| MinIO Console | http://localhost:9001 |

## Health Checks

```bash
curl http://localhost:4000/health
curl http://localhost:8000/health
curl http://localhost:3000/api/health
```

## Structure

```
apps/       web | api | worker | agents
packages/   db | shared | ui | mcp-servers
infra/      docker | observability | oracle-vm | cloudflare
scripts/    bootstrap, seed, backup, secrets
docs/       blueprint and architecture docs
```
