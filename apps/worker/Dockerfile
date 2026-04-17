FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS dev
ENV NODE_ENV=development
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/worker/package.json apps/worker/
COPY packages packages
RUN pnpm install --frozen-lockfile || pnpm install
COPY apps/worker apps/worker
WORKDIR /app/apps/worker
CMD ["pnpm", "dev"]

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/worker/package.json apps/worker/
COPY packages packages
RUN pnpm install --frozen-lockfile
COPY apps/worker apps/worker
WORKDIR /app/apps/worker
RUN pnpm build

FROM node:20-alpine AS prod
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/worker/dist ./dist
COPY --from=build /app/apps/worker/package.json ./
COPY --from=build /app/apps/worker/node_modules ./node_modules
CMD ["node", "dist/worker.js"]
