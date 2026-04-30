# @ai/web

Next.js frontend for MIRA (Personal AI Assistant).

## What this app provides

- Public landing page
- Authentication flows: login/register/onboarding/forgot/reset password
- Protected `/me/*` workspace
- Streaming chat UI with action confirmation controls
- Task/goal/memory/profile/digest/logs pages
- React Query powered API state management

## Tech stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- React Query (`@tanstack/react-query`)
- Cookie-based auth with backend token refresh

## Prerequisites

- Node.js 20+
- pnpm 10+
- Running API service (default `http://localhost:4000`)

## Quick start

From repository root:

```bash
pnpm install
cp apps/web/example.env apps/web/.env.local

# Start web app (http://localhost:3000)
pnpm --filter @ai/web dev
```

`apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Run scripts

From `apps/web`:

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

Or from repo root:

```bash
pnpm --filter @ai/web <script>
```

## Route overview

Public routes:

- `/`
- `/auth/login`
- `/auth/register`
- `/auth/onboarding`
- `/auth/forgot-password`
- `/auth/reset-password`

Protected routes:

- `/me`
- `/me/chat`
- `/me/chat/[id]`
- `/me/conversations`
- `/me/tasks`
- `/me/goals`
- `/me/memory`
- `/me/profile`
- `/me/info-digests`
- `/me/logs`

## API integration model

- All requests are sent to `NEXT_PUBLIC_API_URL`
- `credentials: include` is used for HTTP-only cookie auth
- 401 responses trigger refresh flow and one retry
- Chat streaming reads NDJSON events from `fetch` response body

## Key directories

- `src/app` - route pages (App Router)
- `src/components/pages` - page-level UI modules
- `src/components/common` - reusable UI primitives
- `src/lib/api` - API client and typed endpoint wrappers
- `src/components/providers/query-provider.tsx` - React Query provider
- `src/lib/api/AuthContext.tsx` - user bootstrap and session refresh behavior
