FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# ========== dev ==========
FROM base AS dev
ENV NODE_ENV=development
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY packages packages
RUN pnpm install --frozen-lockfile || pnpm install
COPY apps/api apps/api
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["pnpm", "dev"]

# ========== build ==========
FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY packages packages
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN pnpm build

# ========== prod ==========
FROM node:20-alpine AS prod
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./
COPY --from=build /app/apps/api/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/server.js"]
