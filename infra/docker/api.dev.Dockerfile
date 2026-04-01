FROM node:22-alpine

WORKDIR /app

# Defaults for docker-compose (service hostname `db`). Compose `environment:` overrides these.
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/pma
ENV DATABASE_URL_UNPOOLED=postgresql://postgres:postgres@db:5432/pma

RUN apk add --no-cache openssl libc6-compat

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

# Manifests + root TS config (packages/ai-core extends ../../tsconfig.base.json)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./

# Workspace package.json files so the first install resolves the full graph
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/ai-core/package.json ./packages/ai-core/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages

# pnpm v10 skips dependency postinstall scripts; Prisma client must be generated explicitly
RUN pnpm --filter @ai/api exec prisma generate

EXPOSE 4000

CMD ["pnpm", "turbo", "dev", "--filter=@ai/api"]
