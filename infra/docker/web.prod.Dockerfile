# ---------- BUILDER ----------
FROM node:22-slim AS builder

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/ai-core/package.json ./packages/ai-core/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @ai/web build
RUN pnpm --filter @ai/web deploy --prod --legacy /out/web

# ---------- RUNTIME ----------
FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /out/web .

EXPOSE 3000

CMD ["node", "server.js"]
