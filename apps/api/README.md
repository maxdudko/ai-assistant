# @ai/api

NestJS backend service for MIRA (Personal AI Assistant).

## What this service provides

- Authenticated REST API under `/api`
- Chat orchestration with streaming responses (NDJSON over chunked HTTP)
- Action lifecycle: suggest -> pending -> confirm/dismiss -> execute (with undo for reversible actions)
- Task, goal, day lifecycle, and daily intelligence endpoints
- Memory ingestion and retrieval using PostgreSQL + pgvector
- INFO digests backed by search provider integration
- Scheduler endpoints for cron-style triggers (suitable for serverless cron jobs)

## Tech stack

- NestJS 11
- Prisma ORM
- PostgreSQL with pgvector
- `@ai/ai-core` for framework-agnostic AI logic
- JWT auth with HTTP-only cookies (access + refresh)
- Ollama or OpenAI for LLM and embeddings

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL with pgvector (or Docker)
- Optional: Ollama (local LLM), OpenAI API key, NewsAPI key (INFO mode)

## Quick start

From repository root:

```bash
pnpm install
cp apps/api/example.env apps/api/.env

# Start database only
docker compose -f compose.dev.yaml up -d db

# Apply migrations
pnpm --filter @ai/api exec prisma migrate deploy

# Start API (http://localhost:4000)
pnpm --filter @ai/api dev
```

Optional local AI runtime:

```bash
docker compose -f compose.dev.yaml up -d ollama
```

## Environment variables

Copy `apps/api/example.env` and set at least:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `LLM_PROVIDER` (`ollama` or `openai`)

Provider-specific variables:

- Ollama: `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_EMBED_MODEL`
- OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `OPENAI_EMBED_MODEL`
- Optional embeddings override: `EMBEDDINGS_PROVIDER`

Optional integrations:

- `NEWS_API_KEY` for INFO mode external search
- `CRON_SECRET` to protect `/api/scheduler/*` HTTP trigger routes

## Run scripts

From `apps/api`:

```bash
pnpm dev          # watch mode
pnpm build        # compile Nest app
pnpm start:prod   # run compiled output

pnpm test         # unit tests
pnpm test:e2e     # e2e tests
pnpm test:cov     # coverage
```

Or from repo root:

```bash
pnpm --filter @ai/api <script>
```

## Main endpoint groups

- `/api/auth/*` - register/login/refresh/logout/password flows
- `/api/users/me` - current profile read/update
- `/api/conversations/*` - daily/ad-hoc chat and streaming
- `/api/tasks/*`, `/api/goals/*` - planning entities
- `/api/day/*` - day lifecycle and intelligence
- `/api/actions/*` - pending/confirm/dismiss/undo
- `/api/memory/*` - memory listing/deletion
- `/api/digest/subscriptions` - digest subscriptions
- `/api/logs/*` - AI interaction logs
- `/api/scheduler/*` - scheduler trigger endpoints

## Streaming protocol

`POST /api/conversations/message/stream` returns newline-delimited JSON:

```json
{ "type": "start" }
{ "type": "delta", "delta": "H" }
{ "type": "delta", "delta": "i" }
{ "type": "complete", "conversationId": "...", "message": { "...": "..." }, "actions": [] }
```

## Deployment notes

- `pnpm vercel-build` runs `prisma generate`, `nest build`, and `prisma migrate deploy`.
- Ensure `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are both configured in deployment.
