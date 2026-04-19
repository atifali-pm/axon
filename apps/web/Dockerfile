########################################################################
# Axon Web (Next.js 15) — multi-arch Docker image
#
# Uses Next.js standalone output for a slim runtime image. `next.config.ts`
# must have `output: "standalone"` (set below in the build stage via env).
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
COPY apps/web apps/web
WORKDIR /app/apps/web
EXPOSE 3000
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
COPY apps/web apps/web
RUN pnpm --filter @axon/web build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
# With Next.js standalone output, .next/standalone is a self-contained server.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
