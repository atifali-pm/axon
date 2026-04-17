# End-to-End Zero-Budget AI SaaS Blueprint

> A single, comprehensive guide to building and shipping a production-ready AI/agentic SaaS on a $0 budget. Covers architecture, folder structure, Docker orchestration, queues, databases, LLMs, agents, MCP servers, RAG, auth, payments, observability, deployment, and go-live checklist.

**Target stack**: Next.js + Fastify + Python (agents) + Postgres/pgvector + Redis + BullMQ + n8n + Langfuse + Grafana + LGTM stack + Caddy + Cloudflare Tunnel + Oracle Cloud Always Free.

**Total cost**: $0/month forever. Optional ~$2/year for a real domain.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Tech Stack Summary](#2-tech-stack-summary)
3. [Prerequisites & Free Accounts](#3-prerequisites--free-accounts)
4. [Full Monorepo Structure](#4-full-monorepo-structure)
5. [Environment Configuration](#5-environment-configuration)
6. [Core Services: Docker Compose (Dev)](#6-core-services-docker-compose-dev)
7. [Database Schema & Migrations](#7-database-schema--migrations)
8. [Queue System (BullMQ)](#8-queue-system-bullmq)
9. [API Service (Fastify)](#9-api-service-fastify)
10. [Agent Service (Python + LangGraph)](#10-agent-service-python--langgraph)
11. [MCP Servers](#11-mcp-servers)
12. [Web Frontend (Next.js)](#12-web-frontend-nextjs)
13. [RAG Pipeline](#13-rag-pipeline)
14. [LLM Router (Multi-Provider)](#14-llm-router-multi-provider)
15. [Auth & Multi-Tenancy](#15-auth--multi-tenancy)
16. [Billing (Stripe)](#16-billing-stripe)
17. [Observability (Langfuse + LGTM)](#17-observability-langfuse--lgtm)
18. [Production Deployment (Oracle Cloud)](#18-production-deployment-oracle-cloud)
19. [CI/CD (GitHub Actions)](#19-cicd-github-actions)
20. [Security Hardening](#20-security-hardening)
21. [Backup & Disaster Recovery](#21-backup--disaster-recovery)
22. [Go-Live Checklist](#22-go-live-checklist)
23. [Scaling Path](#23-scaling-path)

---

## 1. System Architecture

```
+----------------------------------------------------------------------+
|                         PUBLIC INTERNET                               |
|                              |                                       |
|                     Cloudflare Tunnel (free)                         |
|                              |                                       |
+------------------------------+---------------------------------------+
                               |
+------------------------------+---------------------------------------+
|               Oracle Cloud Always Free VM (4 cores / 24GB)           |
|                                                                      |
|    +-------------------- Caddy (auto-HTTPS) --------------------+    |
|    |                                                            |    |
|    |  app.domain.xyz  -> Next.js (web)                          |    |
|    |  api.domain.xyz  -> Fastify API                            |    |
|    |  n8n.domain.xyz  -> n8n                                    |    |
|    |  grafana.xyz     -> Grafana                                |    |
|    |  langfuse.xyz    -> Langfuse                               |    |
|    +------------------------------------------------------------+    |
|                                                                      |
|  +----------+  +---------+  +---------+  +----------+  +---------+   |
|  | Next.js  |  |Fastify  |  | BullMQ  |  | Workers  |  | Agents  |   |
|  |  (web)   |  |  (API)  |  | (queue) |  | (worker) |  |(python) |   |
|  +----------+  +---------+  +----+----+  +----------+  +---------+   |
|        |             |           |              |            |       |
|        v             v           v              v            v       |
|  +------------------------------------------------------------------+|
|  | Postgres (pgvector) | Redis (cache+queue) | MinIO (storage)      ||
|  +------------------------------------------------------------------+|
|                                                                      |
|  +------------------------------------------------------------------+|
|  | Observability: Prometheus/Loki/Grafana/cAdvisor/Node Exp.        ||
|  | LLM Ops: Langfuse                                                ||
|  | Automation: n8n                                                  ||
|  +------------------------------------------------------------------+|
+----------------------------------------------------------------------+
                               |
                               v (outbound API calls)
+----------------------------------------------------------------------+
|  External Free APIs:                                                 |
|  Groq (Llama 3.3 free) | Gemini Flash free | OpenRouter free models  |
|  Stripe (pay-per-use) | Resend (3k emails/mo) | Cloudflare R2 (10GB) |
+----------------------------------------------------------------------+
```

**Key design decisions:**
- **Single VM** for simplicity. Scales to thousands of users before needing split.
- **Queue-first architecture**: every LLM call, email, scrape, or long task goes through BullMQ. Makes the system resilient and horizontally scalable.
- **Multi-LLM router**: Groq (fast/free) by default, Gemini as fallback, Claude/GPT reserved for premium features.
- **MCP-native**: every integration exposed as an MCP server so your agents (and external clients like Claude Desktop) can use them.

---

## 2. Tech Stack Summary

| Layer | Technology | Why |
|---|---|---|
| **VM** | Oracle Cloud Always Free (4 ARM cores, 24GB RAM) | Free forever, beefier than most paid tiers |
| **Reverse proxy** | Caddy | Auto-HTTPS, zero config |
| **Tunnel** | Cloudflare Tunnel | No open ports, free forever |
| **Frontend** | Next.js 15 + React 19 + Tailwind + shadcn/ui | Industry standard, streaming UI support |
| **API** | Fastify 5 + TypeScript + Zod | Faster than Express, type-safe |
| **Agents** | Python 3.12 + LangGraph + FastAPI | Best agent orchestration + ecosystem |
| **Queue** | BullMQ (Node) + Redis | Battle-tested, Node-native |
| **DB** | PostgreSQL 16 + pgvector | One DB for relational + vectors |
| **Cache** | Redis 7 | Also powers BullMQ + rate limits |
| **Object storage** | MinIO (self-hosted) or Cloudflare R2 | S3-compatible, free |
| **Search** | Postgres FTS + pgvector hybrid | No separate search infra needed |
| **Auth** | Better Auth | Modern, self-hostable, excellent DX |
| **Payments** | Stripe | No monthly fee, % per transaction |
| **Email** | Resend (3k/mo free) | Best DX, generous free tier |
| **Automation** | n8n self-hosted | Visual workflows |
| **LLM observability** | Langfuse self-hosted | Open source, best-in-class |
| **Metrics** | Prometheus + Grafana | Industry standard |
| **Logs** | Loki + Promtail | Lightweight, integrates with Grafana |
| **LLMs (primary)** | Groq Llama 3.3 + Gemini Flash | Free tiers, production-grade |
| **LLMs (local)** | Ollama + Llama 3.1 / Qwen 2.5 | Privacy mode, zero API cost |
| **Monorepo** | pnpm workspaces + Turborepo | Fast, caching, workspace support |
| **CI/CD** | GitHub Actions | Free for public + 2000 min/mo private |

---

## 3. Prerequisites & Free Accounts

**Local machine:**
- Ubuntu (or macOS/WSL)
- Docker + Docker Compose
- Node.js 20+, pnpm 9+
- Python 3.12+
- Git

**Free accounts to create (all $0):**
- [ ] GitHub
- [ ] Cloudflare (DNS + Tunnel + R2)
- [ ] Oracle Cloud (Always Free VM)
- [ ] Groq (free fast LLM inference)
- [ ] Google AI Studio (Gemini free API key)
- [ ] OpenRouter (unified LLM access + free models)
- [ ] Resend (transactional email, 3k/mo free)
- [ ] Stripe (no fees until you earn)
- [ ] Vercel (optional frontend hosting backup)

**Optional paid (~$2/year):**
- A real domain (.xyz or .site on Namecheap/Porkbun)

---

## 4. Full Monorepo Structure

```
saas-platform/
+-- .github/
|   +-- workflows/
|       +-- ci.yml
|       +-- deploy-api.yml
|       +-- deploy-web.yml
|       +-- deploy-agents.yml
|
+-- apps/
|   +-- web/                        # Next.js 15 frontend
|   |   +-- src/app/
|   |   +-- src/components/
|   |   +-- src/lib/
|   |   +-- Dockerfile
|   |   +-- package.json
|   |
|   +-- api/                        # Fastify backend
|   |   +-- src/
|   |   |   +-- routes/
|   |   |   +-- plugins/
|   |   |   +-- services/
|   |   |   +-- queues/
|   |   |   +-- middleware/
|   |   |   +-- server.ts
|   |   +-- Dockerfile
|   |   +-- package.json
|   |
|   +-- worker/                     # Queue consumers (Node)
|   |   +-- src/
|   |   |   +-- processors/         # One file per queue
|   |   |   +-- worker.ts
|   |   +-- Dockerfile
|   |   +-- package.json
|   |
|   +-- agents/                     # Python agent service
|       +-- src/
|       |   +-- agents/             # LangGraph agent definitions
|       |   +-- tools/              # Agent tools
|       |   +-- api/                # FastAPI endpoints
|       |   +-- main.py
|       +-- Dockerfile
|       +-- pyproject.toml
|
+-- packages/
|   +-- db/                         # Shared DB schema + migrations
|   |   +-- drizzle/
|   |   +-- schema.ts
|   |   +-- package.json
|   |
|   +-- shared/                     # Shared types + Zod schemas
|   |   +-- src/
|   |   |   +-- types.ts
|   |   |   +-- schemas.ts
|   |   |   +-- constants.ts
|   |   +-- package.json
|   |
|   +-- ui/                         # Shared React components
|   |   +-- package.json
|   |
|   +-- mcp-servers/                # MCP servers (each publishable)
|       +-- postgres-mcp/
|       +-- github-mcp/
|       +-- stripe-mcp/
|       +-- custom-mcp/
|
+-- infra/
|   +-- docker/
|   |   +-- docker-compose.dev.yml
|   |   +-- docker-compose.prod.yml
|   |   +-- docker-compose.observability.yml
|   |   +-- Caddyfile
|   |   +-- init-db/
|   |       +-- 01-init.sql
|   |
|   +-- observability/
|   |   +-- prometheus/prometheus.yml
|   |   +-- prometheus/alerts.yml
|   |   +-- loki/loki-config.yml
|   |   +-- promtail/promtail-config.yml
|   |   +-- blackbox/blackbox.yml
|   |   +-- grafana/
|   |       +-- provisioning/datasources/
|   |       +-- provisioning/dashboards/
|   |
|   +-- oracle-vm/
|   |   +-- cloud-init.yml
|   |   +-- setup.sh
|   |
|   +-- cloudflare/
|       +-- tunnel-config.yml
|
+-- scripts/
|   +-- bootstrap.sh
|   +-- seed-db.sh
|   +-- backup-db.sh
|   +-- restore-db.sh
|
+-- .env.example
+-- .gitignore
+-- .dockerignore
+-- docker-compose.yml              # Root: dev stack shortcut
+-- package.json
+-- pnpm-workspace.yaml
+-- turbo.json
+-- tsconfig.base.json
+-- README.md
```

---

## 5. Environment Configuration

**File: `.env.example`**

```bash
# ============================================================
# DOMAIN & APP
# ============================================================
DOMAIN=yourdomain.xyz
NODE_ENV=development
LOG_LEVEL=debug
APP_URL=https://app.${DOMAIN}
API_URL=https://api.${DOMAIN}

# ============================================================
# POSTGRES (used by all services)
# ============================================================
POSTGRES_USER=postgres
POSTGRES_PASSWORD=  # openssl rand -hex 32
POSTGRES_DB=saas
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

# ============================================================
# REDIS
# ============================================================
REDIS_PASSWORD=  # openssl rand -hex 32
REDIS_URL=redis://default:${REDIS_PASSWORD}@redis:6379

# ============================================================
# AUTH (Better Auth)
# ============================================================
BETTER_AUTH_SECRET=  # openssl rand -hex 32
BETTER_AUTH_URL=${APP_URL}

# OAuth providers (all free)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ============================================================
# LLM PROVIDERS (primarily free tiers)
# ============================================================
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=
OPENROUTER_API_KEY=
ANTHROPIC_API_KEY=      # optional, premium tier
OPENAI_API_KEY=         # optional, premium tier

# Ollama (local)
OLLAMA_BASE_URL=http://host.docker.internal:11434

# ============================================================
# OBSERVABILITY
# ============================================================
LANGFUSE_SECRET=  # openssl rand -hex 32
LANGFUSE_SALT=  # openssl rand -hex 32
LANGFUSE_PUBLIC_KEY=  # generated in Langfuse UI after first login
LANGFUSE_SECRET_KEY=  # generated in Langfuse UI after first login
LANGFUSE_HOST=http://langfuse:3000

GRAFANA_USER=admin
GRAFANA_PASSWORD=  # strong password

# ============================================================
# STORAGE
# ============================================================
MINIO_USER=minioadmin
MINIO_PASSWORD=  # openssl rand -hex 32
S3_ENDPOINT=http://minio:9000
S3_BUCKET=uploads
S3_REGION=us-east-1

# Alternative: Cloudflare R2
# S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
# S3_ACCESS_KEY=
# S3_SECRET_KEY=

# ============================================================
# PAYMENTS
# ============================================================
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...

# ============================================================
# EMAIL
# ============================================================
RESEND_API_KEY=re_...
EMAIL_FROM=hello@${DOMAIN}

# ============================================================
# N8N
# ============================================================
N8N_ENCRYPTION_KEY=  # openssl rand -hex 32

# ============================================================
# AGENT SERVICE
# ============================================================
AGENT_SERVICE_URL=http://agents:8000
AGENT_API_KEY=  # openssl rand -hex 32 (internal auth between api <-> agents)

# ============================================================
# CLOUDFLARE
# ============================================================
CLOUDFLARE_TUNNEL_TOKEN=  # generated when creating tunnel
```

**Generate all secrets at once:**

```bash
#!/bin/bash
# scripts/generate-secrets.sh
cat <<EOF > .env.secrets
POSTGRES_PASSWORD=$(openssl rand -hex 32)
REDIS_PASSWORD=$(openssl rand -hex 32)
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
LANGFUSE_SECRET=$(openssl rand -hex 32)
LANGFUSE_SALT=$(openssl rand -hex 32)
MINIO_PASSWORD=$(openssl rand -hex 32)
N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
AGENT_API_KEY=$(openssl rand -hex 32)
GRAFANA_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
EOF
echo "Secrets generated in .env.secrets - merge with .env"
```

---

## 6. Core Services: Docker Compose (Dev)

**File: `infra/docker/docker-compose.dev.yml`**

```yaml
version: "3.9"

name: axon-dev

services:
  # ========== DATA LAYER ==========
  postgres:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./init-db:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks: [app]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: >
      redis-server
      --appendonly yes
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 2gb
      --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
    networks: [app]

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    networks: [app]

  # ========== AUTOMATION ==========
  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_DATABASE: n8n
      DB_POSTGRESDB_USER: ${POSTGRES_USER}
      DB_POSTGRESDB_PASSWORD: ${POSTGRES_PASSWORD}
      N8N_ENCRYPTION_KEY: ${N8N_ENCRYPTION_KEY}
      N8N_HOST: localhost
      N8N_PORT: 5678
      N8N_PROTOCOL: http
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      postgres:
        condition: service_healthy
    networks: [app]

  # ========== OBSERVABILITY (LLM) ==========
  langfuse:
    image: langfuse/langfuse:2
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3001:3000"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/langfuse
      NEXTAUTH_SECRET: ${LANGFUSE_SECRET}
      SALT: ${LANGFUSE_SALT}
      NEXTAUTH_URL: http://localhost:3001
      TELEMETRY_ENABLED: "false"
    networks: [app]

  # ========== APP SERVICES ==========
  api:
    build:
      context: ../..
      dockerfile: apps/api/Dockerfile
      target: dev
    restart: unless-stopped
    env_file: ../../.env
    ports:
      - "4000:4000"
    volumes:
      - ../../apps/api:/app/apps/api
      - ../../packages:/app/packages
      - /app/node_modules
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    networks: [app]

  worker:
    build:
      context: ../..
      dockerfile: apps/worker/Dockerfile
      target: dev
    restart: unless-stopped
    env_file: ../../.env
    volumes:
      - ../../apps/worker:/app/apps/worker
      - ../../packages:/app/packages
      - /app/node_modules
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    networks: [app]
    deploy:
      replicas: 2

  agents:
    build:
      context: ../../apps/agents
      dockerfile: Dockerfile
      target: dev
    restart: unless-stopped
    env_file: ../../.env
    ports:
      - "8000:8000"
    volumes:
      - ../../apps/agents:/app
    depends_on:
      postgres: { condition: service_healthy }
    networks: [app]

  web:
    build:
      context: ../..
      dockerfile: apps/web/Dockerfile
      target: dev
    restart: unless-stopped
    env_file: ../../.env
    ports:
      - "3000:3000"
    volumes:
      - ../../apps/web:/app/apps/web
      - ../../packages:/app/packages
      - /app/node_modules
    networks: [app]

volumes:
  pg_data:
  redis_data:
  minio_data:
  n8n_data:

networks:
  app:
    driver: bridge
```

**File: `infra/docker/init-db/01-init.sql`**

```sql
-- Create additional databases
CREATE DATABASE n8n;
CREATE DATABASE langfuse;

-- Enable extensions on main DB
\c saas
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

---

## 7. Database Schema & Migrations

Using **Drizzle ORM** for type-safe migrations shared across API and workers.

**File: `packages/db/schema.ts`**

```typescript
import {
  pgTable, uuid, text, timestamp, integer, boolean, jsonb,
  pgEnum, vector, index, unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============ ENUMS ============
export const planEnum = pgEnum("plan", ["free", "starter", "pro", "enterprise"]);
export const roleEnum = pgEnum("role", ["owner", "admin", "member", "viewer"]);
export const jobStatusEnum = pgEnum("job_status", [
  "pending", "running", "completed", "failed", "cancelled",
]);

// ============ TENANTS / ORGS ============
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: planEnum("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============ USERS ============
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const members = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqMember: unique().on(t.userId, t.organizationId),
}));

// ============ BETTER AUTH TABLES ============
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull(),
  accountId: text("account_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
});

// ============ API KEYS ============
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPreview: text("key_preview").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ JOBS (async work) ============
export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  type: text("type").notNull(),
  status: jobStatusEnum("status").notNull().default("pending"),
  input: jsonb("input"),
  output: jsonb("output"),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  orgIdx: index("jobs_org_idx").on(t.organizationId, t.createdAt),
  statusIdx: index("jobs_status_idx").on(t.status),
}));

// ============ DOCUMENTS (RAG) ============
export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  source: text("source"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  orgIdx: index("docs_org_idx").on(t.organizationId),
}));

export const chunks = pgTable("chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 768 }),
  metadata: jsonb("metadata"),
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  embeddingIdx: index("chunks_embedding_hnsw_idx")
    .using("hnsw", t.embedding.op("vector_cosine_ops")),
  orgIdx: index("chunks_org_idx").on(t.organizationId),
  ftsIdx: index("chunks_fts_idx").using("gin", t.content),
}));

// ============ CONVERSATIONS ============
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content"),
  toolCalls: jsonb("tool_calls"),
  toolResults: jsonb("tool_results"),
  tokens: jsonb("tokens"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  convIdx: index("msg_conv_idx").on(t.conversationId, t.createdAt),
}));

// ============ USAGE TRACKING (for billing) ============
export const usage = pgTable("usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  metric: text("metric").notNull(),
  quantity: integer("quantity").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  orgMetricIdx: index("usage_org_metric_idx").on(t.organizationId, t.metric, t.createdAt),
}));
```

**Migrations:**

```bash
# packages/db/package.json scripts
pnpm db:generate    # drizzle-kit generate
pnpm db:migrate     # drizzle-kit migrate
pnpm db:studio      # visual DB explorer
```

---

## 8. Queue System (BullMQ)

Every slow or failable operation goes through a queue. This is critical for production reliability.

**File: `apps/api/src/queues/index.ts`**

```typescript
import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// ===== Queue definitions =====
export const queues = {
  agentRun: new Queue("agent.run", { connection }),
  ragIngest: new Queue("rag.ingest", { connection }),
  emailSend: new Queue("email.send", { connection }),
  webhook: new Queue("webhook.send", { connection }),
  scrape: new Queue("scrape.url", { connection }),
  embedding: new Queue("embedding.generate", { connection }),
  stripeWebhook: new Queue("stripe.webhook", { connection }),
} as const;

// ===== Default job options =====
export const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 86400 },
};

// ===== Helper: enqueue with tenant context =====
export async function enqueue<T>(
  queue: Queue,
  jobName: string,
  data: T,
  orgId: string,
  options = {}
) {
  return queue.add(
    jobName,
    { ...data, _meta: { orgId, enqueuedAt: Date.now() } },
    { ...defaultJobOptions, ...options }
  );
}
```

**File: `apps/worker/src/worker.ts`**

```typescript
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { agentRunProcessor } from "./processors/agent-run";
import { ragIngestProcessor } from "./processors/rag-ingest";
import { emailSendProcessor } from "./processors/email-send";
import { embeddingProcessor } from "./processors/embedding";
import { scrapeProcessor } from "./processors/scrape";
import { stripeWebhookProcessor } from "./processors/stripe-webhook";
import { logger } from "./lib/logger";

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

const workers = [
  new Worker("agent.run", agentRunProcessor, { connection, concurrency: 5 }),
  new Worker("rag.ingest", ragIngestProcessor, { connection, concurrency: 3 }),
  new Worker("email.send", emailSendProcessor, { connection, concurrency: 10 }),
  new Worker("embedding.generate", embeddingProcessor, { connection, concurrency: 4 }),
  new Worker("scrape.url", scrapeProcessor, { connection, concurrency: 2 }),
  new Worker("stripe.webhook", stripeWebhookProcessor, { connection, concurrency: 10 }),
];

// Global event handlers
workers.forEach((w) => {
  w.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, queue: w.name, err: err.message }, "Job failed");
  });
  w.on("completed", (job) => {
    logger.info({ jobId: job.id, queue: w.name, duration: job.finishedOn! - job.processedOn! }, "Job completed");
  });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, closing workers");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});

logger.info(`${workers.length} workers started`);
```

**Example processor: `apps/worker/src/processors/agent-run.ts`**

```typescript
import { Job } from "bullmq";
import axios from "axios";
import { db } from "@axon/db";
import { jobs } from "@axon/db/schema";
import { eq } from "drizzle-orm";

export async function agentRunProcessor(job: Job) {
  const { _meta, agentId, input, conversationId } = job.data;
  const orgId = _meta.orgId;

  // Mark running
  await db.update(jobs)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(jobs.id, job.data.jobId));

  try {
    // Call Python agent service
    const response = await axios.post(
      `${process.env.AGENT_SERVICE_URL}/run`,
      { agentId, input, conversationId, orgId },
      {
        headers: { Authorization: `Bearer ${process.env.AGENT_API_KEY}` },
        timeout: 300_000,
      }
    );

    // Mark completed
    await db.update(jobs)
      .set({
        status: "completed",
        output: response.data,
        completedAt: new Date(),
      })
      .where(eq(jobs.id, job.data.jobId));

    return response.data;
  } catch (err: any) {
    await db.update(jobs)
      .set({
        status: "failed",
        error: err.message,
        completedAt: new Date(),
      })
      .where(eq(jobs.id, job.data.jobId));
    throw err;
  }
}
```

**Bull Board (free UI for queue monitoring):**

Add to `apps/api/src/routes/admin.ts`:

```typescript
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import { queues } from "../queues";

export async function setupBullBoard(app: FastifyInstance) {
  const serverAdapter = new FastifyAdapter();
  createBullBoard({
    queues: Object.values(queues).map((q) => new BullMQAdapter(q)),
    serverAdapter,
  });
  serverAdapter.setBasePath("/admin/queues");
  await app.register(serverAdapter.registerPlugin(), {
    prefix: "/admin/queues",
    basePath: "",
  });
}
```

Protect `/admin/queues` behind auth + admin role check.

---

## 9. API Service (Fastify)

**File: `apps/api/src/server.ts`**

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { authPlugin } from "./plugins/auth";
import { metricsPlugin } from "./plugins/metrics";
import { errorHandler } from "./plugins/error-handler";
import { chatRoutes } from "./routes/chat";
import { orgRoutes } from "./routes/organizations";
import { docRoutes } from "./routes/documents";
import { billingRoutes } from "./routes/billing";
import { webhookRoutes } from "./routes/webhooks";
import { healthRoutes } from "./routes/health";
import { logger } from "./lib/logger";

const app = Fastify({
  logger,
  trustProxy: true,
  bodyLimit: 10 * 1024 * 1024,
});

// Security
await app.register(helmet);
await app.register(cors, {
  origin: [process.env.APP_URL!],
  credentials: true,
});
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis: connection,
});

// Observability
await app.register(metricsPlugin);
app.setErrorHandler(errorHandler);

// Auth (Better Auth)
await app.register(authPlugin);

// Routes
await app.register(healthRoutes, { prefix: "/health" });
await app.register(chatRoutes, { prefix: "/api/chat" });
await app.register(orgRoutes, { prefix: "/api/organizations" });
await app.register(docRoutes, { prefix: "/api/documents" });
await app.register(billingRoutes, { prefix: "/api/billing" });
await app.register(webhookRoutes, { prefix: "/webhooks" });

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });
logger.info(`API listening on :${port}`);
```

**Example route: `apps/api/src/routes/chat.ts`**

```typescript
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { queues, enqueue } from "../queues";
import { requireAuth } from "../middleware/auth";
import { db } from "@axon/db";
import { conversations, messages, jobs } from "@axon/db/schema";
import { streamSSE } from "../lib/sse";

const ChatInput = z.object({
  message: z.string().min(1).max(10_000),
  conversationId: z.string().uuid().optional(),
  agentId: z.string().default("default"),
  stream: z.boolean().default(true),
});

export async function chatRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: requireAuth }, async (request, reply) => {
    const { user, organization } = request;
    const input = ChatInput.parse(request.body);

    // Upsert conversation
    const conv = input.conversationId
      ? await db.query.conversations.findFirst({
          where: (c, { eq, and }) => and(
            eq(c.id, input.conversationId!),
            eq(c.organizationId, organization.id),
          ),
        })
      : await db.insert(conversations)
          .values({ organizationId: organization.id, userId: user.id, title: input.message.slice(0, 80) })
          .returning()
          .then(r => r[0]);

    if (!conv) return reply.code(404).send({ error: "Conversation not found" });

    // Save user message
    await db.insert(messages).values({
      conversationId: conv.id,
      role: "user",
      content: input.message,
    });

    if (input.stream) {
      return streamSSE(reply, async (send) => {
        const response = await fetch(`${process.env.AGENT_SERVICE_URL}/stream`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.AGENT_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentId: input.agentId,
            conversationId: conv.id,
            message: input.message,
            orgId: organization.id,
          }),
        });

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          send(decoder.decode(value));
        }
      });
    } else {
      const job = await db.insert(jobs).values({
        organizationId: organization.id,
        type: "agent.run",
        input: { agentId: input.agentId, message: input.message, conversationId: conv.id },
      }).returning().then(r => r[0]);

      await enqueue(queues.agentRun, "run", {
        jobId: job.id,
        agentId: input.agentId,
        input: input.message,
        conversationId: conv.id,
      }, organization.id);

      return { jobId: job.id, status: "pending" };
    }
  });

  app.get("/jobs/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await db.query.jobs.findFirst({
      where: (j, { eq, and }) => and(
        eq(j.id, id),
        eq(j.organizationId, request.organization.id),
      ),
    });
    if (!job) return reply.code(404).send({ error: "Not found" });
    return job;
  });
}
```

---

## 10. Agent Service (Python + LangGraph)

**File: `apps/agents/src/main.py`**

```python
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import os
import json
from src.agents.default_agent import run_default_agent, stream_default_agent
from src.agents.research_agent import run_research_agent

app = FastAPI(title="Agent Service")

AGENT_API_KEY = os.environ["AGENT_API_KEY"]

def verify_internal(authorization: str = Header(...)):
    if authorization != f"Bearer {AGENT_API_KEY}":
        raise HTTPException(401, "Unauthorized")

class RunInput(BaseModel):
    agentId: str
    message: str
    conversationId: str
    orgId: str
    input: Optional[dict] = None

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/run", dependencies=[Depends(verify_internal)])
async def run(payload: RunInput):
    if payload.agentId == "default":
        result = await run_default_agent(payload)
    elif payload.agentId == "research":
        result = await run_research_agent(payload)
    else:
        raise HTTPException(400, f"Unknown agent: {payload.agentId}")
    return result

@app.post("/stream", dependencies=[Depends(verify_internal)])
async def stream(payload: RunInput):
    async def event_generator():
        async for event in stream_default_agent(payload):
            yield f"data: {json.dumps(event)}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

**File: `apps/agents/src/agents/default_agent.py`**

```python
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.messages import HumanMessage, SystemMessage
from typing import TypedDict, Annotated, Sequence
import operator
from src.llm_router import get_llm
from src.tools import rag_search_tool, web_search_tool, db_query_tool
from src.observability import langfuse_handler

class AgentState(TypedDict):
    messages: Annotated[Sequence, operator.add]
    org_id: str
    conversation_id: str

tools = [rag_search_tool, web_search_tool, db_query_tool]
tool_node = ToolNode(tools)

async def call_llm(state: AgentState):
    llm = get_llm(provider="groq", model="llama-3.3-70b-versatile").bind_tools(tools)
    response = await llm.ainvoke(state["messages"])
    return {"messages": [response]}

def should_continue(state: AgentState):
    last = state["messages"][-1]
    if last.tool_calls:
        return "tools"
    return END

# Build graph
workflow = StateGraph(AgentState)
workflow.add_node("llm", call_llm)
workflow.add_node("tools", tool_node)
workflow.set_entry_point("llm")
workflow.add_conditional_edges("llm", should_continue)
workflow.add_edge("tools", "llm")

graph = workflow.compile()

async def run_default_agent(payload):
    initial_state = {
        "messages": [
            SystemMessage(content="You are a helpful AI assistant for an organization."),
            HumanMessage(content=payload.message),
        ],
        "org_id": payload.orgId,
        "conversation_id": payload.conversationId,
    }
    result = await graph.ainvoke(
        initial_state,
        config={"callbacks": [langfuse_handler], "metadata": {"org_id": payload.orgId}},
    )
    return {"messages": [m.dict() for m in result["messages"]]}

async def stream_default_agent(payload):
    initial_state = {
        "messages": [HumanMessage(content=payload.message)],
        "org_id": payload.orgId,
        "conversation_id": payload.conversationId,
    }
    async for event in graph.astream_events(initial_state, version="v2"):
        yield event
```

**File: `apps/agents/src/llm_router.py`**

```python
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_community.chat_models import ChatOllama
import os

def get_llm(provider: str = "groq", model: str = None, **kwargs):
    """
    Multi-provider LLM router with free-tier defaults.
    Fallback order: groq -> gemini -> openrouter -> anthropic -> openai
    """
    providers = {
        "groq": lambda: ChatGroq(
            model=model or "llama-3.3-70b-versatile",
            api_key=os.environ["GROQ_API_KEY"],
            **kwargs,
        ),
        "gemini": lambda: ChatGoogleGenerativeAI(
            model=model or "gemini-2.0-flash",
            google_api_key=os.environ["GEMINI_API_KEY"],
            **kwargs,
        ),
        "openrouter": lambda: ChatOpenAI(
            model=model or "deepseek/deepseek-chat",
            api_key=os.environ["OPENROUTER_API_KEY"],
            base_url="https://openrouter.ai/api/v1",
            **kwargs,
        ),
        "anthropic": lambda: ChatAnthropic(
            model=model or "claude-sonnet-4-5",
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            **kwargs,
        ),
        "openai": lambda: ChatOpenAI(
            model=model or "gpt-4o-mini",
            api_key=os.environ.get("OPENAI_API_KEY"),
            **kwargs,
        ),
        "ollama": lambda: ChatOllama(
            model=model or "llama3.1:8b",
            base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
            **kwargs,
        ),
    }
    return providers[provider]()
```

**File: `apps/agents/src/observability.py`**

```python
from langfuse.callback import CallbackHandler
import os

langfuse_handler = CallbackHandler(
    public_key=os.environ["LANGFUSE_PUBLIC_KEY"],
    secret_key=os.environ["LANGFUSE_SECRET_KEY"],
    host=os.environ["LANGFUSE_HOST"],
)
```

**File: `apps/agents/pyproject.toml`**

```toml
[project]
name = "agents"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "pydantic>=2.9",
    "langgraph>=0.2.50",
    "langchain>=0.3",
    "langchain-core>=0.3",
    "langchain-groq>=0.2",
    "langchain-google-genai>=2.0",
    "langchain-openai>=0.2",
    "langchain-anthropic>=0.3",
    "langchain-community>=0.3",
    "langfuse>=2.50",
    "asyncpg>=0.30",
    "httpx>=0.27",
    "tenacity>=9.0",
]
```

---

## 11. MCP Servers

**File: `packages/mcp-servers/postgres-mcp/src/index.ts`**

```typescript
#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Pool } from "pg";
import { z } from "zod";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const server = new Server(
  { name: "postgres-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "query",
      description: "Execute a read-only SQL query",
      inputSchema: {
        type: "object",
        properties: { sql: { type: "string" } },
        required: ["sql"],
      },
    },
    {
      name: "list_tables",
      description: "List tables in the database",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === "query") {
    const sql = (args as any).sql as string;
    if (!/^\s*(select|with)/i.test(sql)) {
      throw new Error("Only SELECT/WITH queries allowed");
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      const result = await client.query(sql);
      await client.query("COMMIT");
      return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
    } finally {
      client.release();
    }
  }

  if (name === "list_tables") {
    const result = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    );
    return { content: [{ type: "text", text: JSON.stringify(result.rows.map(r => r.table_name)) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("postgres-mcp running");
```

---

## 12. Web Frontend (Next.js)

**File: `apps/web/src/app/chat/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useChat } from "ai/react";

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
  });

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="space-y-4 mb-4">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
            <div className={`inline-block rounded-lg px-4 py-2 ${
              m.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask anything..."
          className="flex-1 border rounded px-3 py-2"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

Backend proxy route: `apps/web/src/app/api/chat/route.ts`

```typescript
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();

  const response = await fetch(`${process.env.API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: req.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

---

## 13. RAG Pipeline

**Ingest flow (via queue):**

```typescript
// apps/worker/src/processors/rag-ingest.ts
import { Job } from "bullmq";
import { chunks, documents } from "@axon/db/schema";
import { db } from "@axon/db";
import { chunkText } from "../lib/chunker";
import { generateEmbeddings } from "../lib/embeddings";
import { extractText } from "../lib/extractors";

export async function ragIngestProcessor(job: Job) {
  const { _meta, documentId, sourceUrl, sourceType } = job.data;
  const orgId = _meta.orgId;

  // 1. Extract raw text
  const text = await extractText(sourceUrl, sourceType);

  // 2. Chunk (500 tokens, 50 overlap)
  const textChunks = chunkText(text, { size: 500, overlap: 50 });

  // 3. Generate embeddings (batched)
  const embeddings = await generateEmbeddings(textChunks);

  // 4. Bulk insert
  await db.insert(chunks).values(
    textChunks.map((content, i) => ({
      documentId,
      organizationId: orgId,
      content,
      embedding: embeddings[i],
      tokenCount: Math.ceil(content.length / 4),
    }))
  );

  return { chunks: textChunks.length };
}
```

**Embeddings (free via Ollama):**

```typescript
// apps/worker/src/lib/embeddings.ts
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results = await Promise.all(
    texts.map(async (text) => {
      const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/embeddings`, {
        method: "POST",
        body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
      });
      const data = await res.json();
      return data.embedding;
    })
  );
  return results;
}
```

**Hybrid search (vector + full-text):**

```sql
WITH vector_results AS (
  SELECT id, content, 1 - (embedding <=> $1) AS vec_score
  FROM chunks
  WHERE organization_id = $2
  ORDER BY embedding <=> $1
  LIMIT 20
),
keyword_results AS (
  SELECT id, content, ts_rank(to_tsvector('english', content), plainto_tsquery('english', $3)) AS kw_score
  FROM chunks
  WHERE organization_id = $2 AND to_tsvector('english', content) @@ plainto_tsquery('english', $3)
  LIMIT 20
)
SELECT DISTINCT ON (c.id) c.id, c.content,
  COALESCE(v.vec_score, 0) * 0.7 + COALESCE(k.kw_score, 0) * 0.3 AS score
FROM chunks c
LEFT JOIN vector_results v ON v.id = c.id
LEFT JOIN keyword_results k ON k.id = c.id
WHERE v.id IS NOT NULL OR k.id IS NOT NULL
ORDER BY c.id, score DESC
LIMIT 10;
```

---

## 14. LLM Router (Multi-Provider)

Key points:

- **Primary**: Groq Llama 3.3 70B (free, fast)
- **Fallback**: Gemini 2.0 Flash (free tier)
- **Reasoning**: OpenRouter's free DeepSeek/Llama models
- **Premium tier**: Claude/GPT (only when user pays)
- **Privacy mode**: Ollama local

**Automatic fallback with circuit breaker:**

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=10))
async def call_with_fallback(messages, providers=["groq", "gemini", "openrouter"]):
    last_error = None
    for provider in providers:
        try:
            llm = get_llm(provider=provider)
            return await llm.ainvoke(messages)
        except Exception as e:
            last_error = e
            continue
    raise last_error
```

---

## 15. Auth & Multi-Tenancy

**Better Auth configuration: `apps/web/src/lib/auth.ts`**

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db } from "@axon/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      defaultRole: "member",
    }),
  ],
});
```

**Tenant isolation middleware:**

```typescript
// apps/api/src/middleware/auth.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "../lib/auth";

declare module "fastify" {
  interface FastifyRequest {
    user: { id: string; email: string };
    organization: { id: string; plan: string };
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session) return reply.code(401).send({ error: "Unauthorized" });

  req.user = session.user;

  const orgId = req.headers["x-organization-id"] as string || session.activeOrganizationId;
  if (!orgId) return reply.code(400).send({ error: "No active organization" });

  const org = await db.query.organizations.findFirst({ where: (o, { eq }) => eq(o.id, orgId) });
  if (!org) return reply.code(403).send({ error: "Org not found" });

  const member = await db.query.members.findFirst({
    where: (m, { eq, and }) => and(eq(m.userId, session.user.id), eq(m.organizationId, orgId)),
  });
  if (!member) return reply.code(403).send({ error: "Not a member" });

  req.organization = org;
}
```

**Row-Level Security (belt-and-suspenders):**

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON documents
  USING (organization_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON chunks
  USING (organization_id = current_setting('app.current_org_id')::uuid);
```

---

## 16. Billing (Stripe)

**Checkout flow:**

```typescript
// apps/api/src/routes/billing.ts
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function billingRoutes(app: FastifyInstance) {
  app.post("/checkout", { preHandler: requireAuth }, async (req, reply) => {
    const { plan } = req.body as { plan: "starter" | "pro" };

    const priceId = {
      starter: process.env.STRIPE_PRICE_STARTER,
      pro: process.env.STRIPE_PRICE_PRO,
    }[plan]!;

    let customerId = req.organization.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { organizationId: req.organization.id },
      });
      customerId = customer.id;
      await db.update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, req.organization.id));
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/billing/success`,
      cancel_url: `${process.env.APP_URL}/billing`,
    });

    return { url: session.url };
  });

  app.post("/webhook", { config: { rawBody: true } }, async (req, reply) => {
    const sig = req.headers["stripe-signature"]!;
    const event = stripe.webhooks.constructEvent(
      req.rawBody!,
      sig as string,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    await enqueue(queues.stripeWebhook, "process", { event }, "system");
    return { received: true };
  });
}
```

---

## 17. Observability (Langfuse + LGTM)

Key integration points:

- **Fastify metrics**: `/metrics` endpoint scraped by Prometheus
- **Langfuse tracing**: automatic via LangGraph callback
- **Loki log shipping**: Promtail scrapes all container logs
- **Grafana alerting**: ntfy.sh for free phone push notifications

**Quick start dashboards to import:**
- Node Exporter Full: `1860`
- Docker cAdvisor: `14282`
- Postgres: `9628`
- Redis: `11835`
- Blackbox: `7587`
- Loki logs: `13639`

---

## 18. Production Deployment (Oracle Cloud)

**Oracle VM setup: `infra/oracle-vm/setup.sh`**

```bash
#!/bin/bash
set -euo pipefail

sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git ufw fail2ban htop vim unzip

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo apt-get install -y docker-compose-plugin

# Firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw --force enable

# Fail2ban
sudo systemctl enable --now fail2ban

# Cloudflared
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb && rm cloudflared.deb

# Swap (ARM VMs benefit)
if [ ! -f /swapfile ]; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# Keep-alive (prevents Oracle reclaim)
(crontab -l 2>/dev/null; echo "*/30 * * * * curl -s https://cloudflare.com > /dev/null") | crontab -

# Node + pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm

echo "Setup complete. Log out and back in for docker group."
```

**Caddyfile:**

```caddy
{
    email you@example.com
}

app.{$DOMAIN} {
    reverse_proxy web:3000
    encode gzip zstd
}

api.{$DOMAIN} {
    reverse_proxy api:4000
    header Access-Control-Allow-Origin "https://app.{$DOMAIN}"
    rate_limit {
        zone api { events 100 window 1m }
    }
}

n8n.{$DOMAIN} {
    reverse_proxy n8n:5678
}

grafana.{$DOMAIN} {
    reverse_proxy grafana:3000
}

langfuse.{$DOMAIN} {
    reverse_proxy langfuse:3000
}

admin.{$DOMAIN} {
    basicauth {
        admin {env.ADMIN_PASSWORD_HASH}
    }
    reverse_proxy api:4000/admin/queues
}
```

---

## 19. CI/CD (GitHub Actions)

**File: `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: test
        options: --health-cmd pg_isready
        ports: [5432:5432]
      redis:
        image: redis:7
        ports: [6379:6379]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/postgres
          REDIS_URL: redis://localhost:6379
```

---

## 20. Security Hardening

**Checklist:**

- [ ] All secrets in env vars, never in code
- [ ] `.env` in `.gitignore`
- [ ] HTTPS enforced via Caddy (automatic)
- [ ] CORS whitelist: only `app.domain.xyz`
- [ ] CSRF protection on state-changing endpoints
- [ ] Rate limiting (Fastify `@fastify/rate-limit` with Redis)
- [ ] Input validation on every route (Zod)
- [ ] SQL: only parameterized queries (Drizzle does this by default)
- [ ] Row-Level Security on tenant-scoped tables
- [ ] API keys stored hashed (bcrypt or argon2)
- [ ] Helmet middleware for security headers
- [ ] Auth cookies: `httpOnly`, `secure`, `sameSite=lax`
- [ ] Session rotation on privilege escalation
- [ ] MCP servers: whitelist read-only queries, validate inputs
- [ ] Agent tools: sandboxed execution, allowlist external domains
- [ ] LLM output: escape HTML before rendering to prevent XSS
- [ ] Stripe webhooks: verify signatures
- [ ] UFW firewall: only SSH + tunnel
- [ ] Fail2ban on SSH
- [ ] Cloudflare Tunnel = no public IP exposure
- [ ] Database: not exposed to public internet
- [ ] Admin routes protected by basic auth + org role check
- [ ] Dependency scanning: `pnpm audit`, GitHub Dependabot
- [ ] Secret scanning: GitHub secret scanner

---

## 21. Backup & Disaster Recovery

**Automated Postgres backups to Cloudflare R2:**

```bash
# scripts/backup-db.sh
#!/bin/bash
set -euo pipefail

DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="/tmp/axon-backup-${DATE}.sql.gz"

docker exec postgres pg_dumpall -U postgres | gzip > "${BACKUP_FILE}"

# Upload to R2 (using rclone)
rclone copy "${BACKUP_FILE}" r2:axon-backups/

# Retention: keep 30 days
rclone delete --min-age 30d r2:axon-backups/

rm "${BACKUP_FILE}"
echo "Backup complete: ${DATE}"
```

---

## 22. Go-Live Checklist

**Infra:**
- [ ] Oracle VM provisioned & hardened
- [ ] Cloudflare DNS + Tunnel configured
- [ ] Caddy auto-HTTPS working on all subdomains
- [ ] All env secrets generated and saved to `.env`
- [ ] Docker Compose `up -d` succeeds for prod
- [ ] All healthchecks passing

**App:**
- [ ] DB migrations applied
- [ ] Auth flow tested (signup, login, OAuth, org creation)
- [ ] Chat streaming works end-to-end
- [ ] Agent tool-calls working via Langfuse trace
- [ ] RAG ingest + search tested
- [ ] MCP servers connectable from Claude Desktop
- [ ] Queue workers processing jobs
- [ ] Bull Board accessible at `/admin/queues`

**Billing:**
- [ ] Stripe test mode: checkout + webhook working
- [ ] Subscription upgrade/downgrade tested
- [ ] Usage metering recorded in `usage` table
- [ ] Plan limits enforced

**Observability:**
- [ ] Grafana dashboards imported
- [ ] Prometheus scraping all targets
- [ ] Loki receiving logs
- [ ] Langfuse receiving traces
- [ ] Alert channel configured (ntfy/email)
- [ ] Uptime checks on main endpoints

**Ops:**
- [ ] Backup cron running + restore tested
- [ ] CI/CD: push to main deploys API+web+worker
- [ ] Documented runbook for common incidents

**Launch:**
- [ ] Landing page copy finalized
- [ ] First 5 customers onboarded manually for feedback
- [ ] Analytics (PostHog self-hosted or Plausible) working

---

## 23. Scaling Path

| Users | MRR | Action |
|---|---|---|
| 0-100 | $0-$1k | Single Oracle VM. Everything on one box. |
| 100-1,000 | $1k-$10k | Add second VM for workers. Move DB to managed. |
| 1,000-10,000 | $10k-$100k | Split: DB server, app servers, worker pool. |
| 10,000+ | $100k+ | Kubernetes, read replicas, CDN, regional deployment. |

---

## Appendix A: Bootstrap Commands

```bash
# 1. Clone and bootstrap
git clone https://github.com/you/axon
cd axon
cp .env.example .env
bash scripts/generate-secrets.sh

# 2. Install deps
pnpm install

# 3. Start infrastructure
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 4. Run migrations
pnpm --filter @axon/db db:migrate

# 5. Start dev servers
pnpm dev

# 6. Access:
#    Web:       http://localhost:3000
#    API:       http://localhost:4000
#    Agents:    http://localhost:8000
#    n8n:       http://localhost:5678
#    Langfuse:  http://localhost:3001
#    Grafana:   http://localhost:3002
#    MinIO:     http://localhost:9001
```

---

*Version 1.0 - April 2026*
