FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/web/package.json packages/web/
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY . .
RUN pnpm --filter @nxlink-vr/server db:generate
RUN pnpm --filter @nxlink-vr/server build
RUN pnpm --filter @nxlink-vr/web build

FROM base AS server-runner
WORKDIR /app/packages/server
COPY --from=builder /app /app
EXPOSE 3009
CMD ["node", "dist/server/src/index.js"]
