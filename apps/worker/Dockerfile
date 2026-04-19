########################################################################
# Axon Worker (BullMQ consumers) — multi-arch Docker image
########################################################################

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS dev
ENV NODE_ENV=development
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY apps/agents/package.json apps/agents/
COPY packages packages
RUN pnpm install --frozen-lockfile || pnpm install
COPY apps/worker apps/worker
WORKDIR /app/apps/worker
CMD ["pnpm", "dev"]

FROM base AS build
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY apps/agents/package.json apps/agents/
COPY packages packages
RUN pnpm install --frozen-lockfile
COPY apps/worker apps/worker
RUN pnpm --filter @axon/worker build

FROM node:20-alpine AS prod
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/apps/worker/package.json ./apps/worker/
COPY --from=build /app/packages ./packages
RUN pnpm install --prod --frozen-lockfile --filter @axon/worker...
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
WORKDIR /app/apps/worker
CMD ["node", "dist/worker.js"]
