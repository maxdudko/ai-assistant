# ---------- BUILDER ----------
FROM node:20-bullseye AS builder

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @ai/client build
RUN pnpm --filter @ai/client deploy --prod /out/client

# ---------- RUNTIME ----------
FROM node:20-bullseye

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /out/client .

EXPOSE 3000

CMD ["pnpm", "start"]
