########################################################################
# Axon API (Fastify 5) — multi-arch Docker image
#
# Build: docker buildx build --platform linux/arm64 -t ghcr.io/USER/axon-api:TAG -f apps/api/Dockerfile .
# Must be built from the repo root (pnpm monorepo context).
########################################################################

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# ---------- dev ----------
FROM base AS dev
ENV NODE_ENV=development
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY apps/agents/package.json apps/agents/
COPY packages packages
RUN pnpm install --frozen-lockfile || pnpm install
COPY apps/api apps/api
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["pnpm", "dev"]

# ---------- build ----------
FROM base AS build
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY apps/agents/package.json apps/agents/
COPY packages packages
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
RUN pnpm --filter @axon/api build

# ---------- prod ----------
FROM node:20-alpine AS prod
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages ./packages
RUN pnpm install --prod --frozen-lockfile --filter @axon/api...
COPY --from=build /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
