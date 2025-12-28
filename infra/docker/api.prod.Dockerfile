# ---------- BUILDER ----------
FROM node:20-bullseye AS builder

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @ai/api build

RUN pnpm --filter @ai/api deploy --prod /out/api

# ---------- RUNTIME ----------
FROM node:20-bullseye

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /out/api .

EXPOSE 4000

CMD ["node", "dist/main.js"]
