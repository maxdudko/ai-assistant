FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./

COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/ai-core/package.json ./packages/ai-core/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages

EXPOSE 3000

CMD ["pnpm", "turbo", "dev", "--filter=@ai/web"]
