# ---------- BUILDER ----------
FROM node:22-slim AS builder

WORKDIR /repo

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/ai-core/package.json ./packages/ai-core/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @ai/api exec prisma generate
RUN pnpm --filter @ai/api build

RUN pnpm --filter @ai/api deploy --prod --legacy /out/api

# ---------- RUNTIME ----------
FROM node:22-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /out/api .

EXPOSE 4000

CMD ["node", "dist/main.js"]
