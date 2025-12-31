# ---------- BUILDER ----------
FROM node:22.12-bullseye AS builder

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @ai/web build
RUN pnpm --filter @ai/web deploy --prod /out/web

# ---------- RUNTIME ----------
FROM node:20-bullseye

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /out/web .

EXPOSE 3000

CMD ["pnpm", "start"]
