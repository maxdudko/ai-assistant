# MIRA — Personal AI Assistant

**Current release:** **v0.3 (Beta) — Insight & Reflection Layer**

**MIRA** is a personal AI-powered assistant designed to help individuals manage their daily life, reduce cognitive load, and think more clearly in an information-saturated world.

This project is about **augmenting individual autonomy, clarity, and control** — not replacing humans with AI.

> **What's new in v0.3:** automatic weekly reflections, expanded pattern
> detection (procrastination, overload, productivity peaks), tighter coupling
> between daily tasks and personal goals, and the upgraded **TruthLens v2**
> comparative information layer. See [`docs/roadmap.md`](docs/roadmap.md#-v03--insight--reflection-layer-).

---

## 🎯 What is MIRA?

MIRA is a **stateful personal AI agent** that:

- Understands user context through long-term memory
- Remembers preferences, patterns, and habits
- Helps plan days and manage tasks intelligently
- Provides rational, calm support across different modes
- Grows and adapts with the user over time

Unlike generic chatbots, MIRA maintains **persistent personal context**, making interactions increasingly relevant and personalized through vector-based memory retrieval (RAG).

---

## 🏗️ Architecture Overview

### Technology Stack

| Layer            | Technologies                                      |
| ---------------- | ------------------------------------------------- |
| **Frontend**     | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| **Backend**      | NestJS, Prisma ORM, PostgreSQL + pgvector         |
| **AI Core**      | Custom LLM abstraction (Ollama/OpenAI), RAG       |
| **Build System** | Turborepo, pnpm workspaces                        |
| **Deployment**   | Docker, Docker Compose                            |

### Monorepo Structure

```
ai-assistant/
├── apps/
│   ├── api/                    # NestJS backend API
│   │   ├── src/
│   │   │   ├── auth/          # JWT authentication
│   │   │   ├── conversations/ # Index orchestration
│   │   │   ├── ai/            # AI service adapter
│   │   │   ├── memory/        # RAG memory system
│   │   │   ├── tasks/         # Task management
│   │   │   ├── goals/         # Goal tracking
│   │   │   ├── actions/       # AI action execution
│   │   │   └── ...
│   │   ├── prisma/
│   │   │   ├── schema.prisma  # Database schema
│   │   │   └── migrations/    # Version-controlled migrations
│   │   └── package.json
│   │
│   └── web/                   # Next.js frontend
│       ├── src/
│       │   ├── app/           # Next.js App Router pages
│       │   ├── components/    # React components
│       │   └── lib/api/       # API client layer
│       └── package.json
│
├── packages/
│   ├── ai-core/               # Framework-agnostic AI library
│   │   ├── src/
│   │   │   ├── ai.service.ts      # Main orchestrator
│   │   │   ├── providers/         # LLM provider abstraction
│   │   │   ├── prompts/           # Prompt builders
│   │   │   ├── memory/            # Memory extraction
│   │   │   └── types/             # Core types
│   │   └── package.json
│   │
│   └── shared-types/          # Common type definitions
│       └── src/actions/       # Action types
│
├── infra/docker/              # Docker build files
├── docs/                      # Documentation
├── pnpm-workspace.yaml        # Workspace configuration
├── turbo.json                 # Turborepo configuration
└── package.json               # Root package.json
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ and **pnpm** 10+
- **Docker** and **Docker Compose** (for PostgreSQL + pgvector)
- **Ollama** (optional, for local LLM) or **OpenAI API key** (for cloud LLM)

### 1. Clone the Repository

```bash
git clone https://github.com/maxdudko/ai-assistant.git
cd ai-assistant
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start Infrastructure (PostgreSQL + pgvector)

```bash
docker compose -f compose.dev.yaml up -d db
```

### 4. Configure Environment Variables

#### Backend (`apps/api/.env`)

```bash
cp apps/api/example.env apps/api/.env
```

Edit `apps/api/.env`:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pma"
DATABASE_URL_UNPOOLED="postgresql://postgres:postgres@localhost:5432/pma"

# JWT
JWT_SECRET="your-secret-key-change-in-production"

# LLM Provider
LLM_PROVIDER="ollama" # ollama | openai

# Ollama
OLLAMA_URL="http://localhost:11434"
OLLAMA_MODEL="gemma3:1b"
OLLAMA_EMBED_MODEL="nomic-embed-text"

# OpenAI
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"
OPENAI_BASE_URL="https://api.openai.com/v1"

# Embeddings provider (defaults to LLM_PROVIDER when omitted)
# EMBEDDINGS_PROVIDER="ollama" # ollama | openai
# OPENAI_EMBED_MODEL="text-embedding-3-large"

# Optional INFO mode search provider
NEWS_API_KEY="your-newsapi-key"

# CORS
CORS_ORIGIN="http://localhost:3000"

# Stripe (optional — Pro checkout/webhooks disabled if unset)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."  # from: stripe listen --forward-to localhost:4000/api/subscriptions/webhook
STRIPE_PRO_PRICE_ID="price_..."
STRIPE_CHECKOUT_SUCCESS_URL="http://localhost:3000/me/subscription?checkout=success"
STRIPE_CHECKOUT_CANCEL_URL="http://localhost:3000/me/subscription?checkout=canceled"
STRIPE_BILLING_PORTAL_RETURN_URL="http://localhost:3000/me/subscription"
```

#### Frontend (`apps/web/.env.local`)

```bash
cp apps/web/example.env apps/web/.env.local
```

Edit `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

### 5. Run Database Migrations

```bash
cd apps/api
pnpm prisma migrate deploy
cd ../..
```

### 6. Start Development Servers

```bash
# Start both frontend and backend
pnpm dev

# Or start individually:
# Backend only (http://localhost:4000)
cd apps/api && pnpm dev

# Frontend only (http://localhost:3000)
cd apps/web && pnpm dev
```

### 7. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **API Health Check**: http://localhost:4000/api

---

## 🧪 Development Workflow

### Project Scripts

```bash
# Development (all apps)
pnpm dev

# Build all packages
pnpm build

# Type checking
pnpm typecheck

# Linting
pnpm lint
pnpm lint:fix

# Code formatting
pnpm format
pnpm format:fix
```

### Database Operations

```bash
cd apps/api

# Create a new migration
pnpm prisma migrate dev --name your_migration_name

# Apply migrations
pnpm prisma migrate deploy

# Generate Prisma Client
pnpm prisma generate

# Open Prisma Studio (DB GUI)
pnpm prisma studio

# Reset database (WARNING: deletes all data)
pnpm prisma migrate reset
```

### Working with the AI Core Package

The `@ai/ai-core` package is framework-agnostic and can be used independently:

```typescript
import { AiService, OllamaProvider } from '@ai/ai-core';

// Create a provider
const provider = new OllamaProvider({
  url: 'http://localhost:11434',
  model: 'gemma3:1b',
});

// Create AI service
const aiService = new AiService({
  provider,
  enableStubFallback: true,
});

// Generate response
const response = await aiService.generateResponse('Hello!', {
  mode: ConversationMode.MANAGER,
  messages: [],
  memories: [],
});
```

---

## 🤖 How the AI Package Works

### Architecture

The AI system is split into three layers:

1. **AI Core Package** (`@ai/ai-core`) - Framework-agnostic AI logic
2. **Backend Adapter** (`apps/api/src/ai/`) - NestJS integration layer
3. **Conversation Orchestrator** (`apps/api/src/conversations/`) - Full lifecycle management

### Key Components

#### 1. LLM Provider Abstraction

```typescript
interface LlmProvider {
  generate(request: LlmRequest): Promise<LlmResponse>;
  generateStream?(request: LlmRequest): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
  getName(): string;
}
```

**Supported Providers**:

- `OllamaProvider` - Local LLM (Ollama)
- `OpenAIProvider` - Cloud LLM (OpenAI API)

Easily extensible for Anthropic, Google, etc.

#### 2. Conversation Modes

MIRA adapts its behavior based on the current mode:

| Mode           | Purpose                     | System Prompt Focus            |
| -------------- | --------------------------- | ------------------------------ |
| **MANAGER**    | Task planning, productivity | Action-oriented, structured    |
| **REFLECTION** | End-of-day summaries        | Introspective, insight-focused |
| **COMPANION**  | Supportive dialogue         | Empathetic, conversational     |
| **INFO**       | Information digests         | Factual, concise summaries     |

#### 3. Prompt Building

System prompts are dynamically built with:

- **Mode-specific instructions** - Task management vs. reflection
- **User profile adaptation** - Tone, verbosity, emoji usage
- **Memory context** - Relevant facts from long-term memory (RAG)
- **Task context** - Today's tasks, backlog items
- **Day context** - Time of day, day state (START/ACTIVE/END)

#### 4. Structured Response Parsing

The AI can return structured data in JSON format:

```json
{
  "text": "I've created a task for you...",
  "actions": [
    {
      "id": "uuid",
      "type": "TASK_CREATE",
      "payload": { "name": "Buy groceries", "priority": "HIGH" },
      "confidence": 0.9,
      "requiresConfirmation": true
    }
  ],
  "memoryCandidates": [
    {
      "content": "User prefers morning meetings",
      "type": "FACTUAL",
      "importance": 8,
      "tags": ["preference", "schedule"],
      "confidence": 0.95
    }
  ]
}
```

#### 5. Memory System (RAG)

**Ingestion Pipeline**:

```
User Message → AI Response → Extract Memory Candidates
  → Filter (confidence >= 0.7, importance >= 5)
  → Generate Embedding (vector)
  → Store in PostgreSQL (pgvector)
```

**Retrieval Pipeline**:

```
User Message → Generate Query Embedding
  → Vector Similarity Search (pgvector)
  → Retrieve Top K Memories
  → Include in System Prompt
```

#### 6. Action Execution System

**Flow**:

```
AI suggests action → Store as ActionCandidate (PENDING)
  → User confirms → Status: CONFIRMED
  → ActionExecutorService.execute()
  → Status: EXECUTED (or FAILED)
  → (Optional) User can dismiss pending actions or undo supported executed actions
  → Log result
```

**Supported Actions**:

- `TASK_CREATE` - Create new task
- `TASK_UPDATE_STATUS` - Change task status
- `TASK_SET_PRIORITY` - Adjust priority
- `TASK_SET_DUE_DATE` - Set or update due date
- `TASK_COMPLETE` - Mark as done
- `DAY_START` - Begin day
- `DAY_END` - End day with reflection
- `SUGGEST_DIGEST_SUBSCRIPTION` - Subscribe to info digest
- `SIMPLIFY_DAY` - Keep top priorities and move overflow tasks
- `SPLIT_TASK` - Split a task into smaller subtasks
- `RESCHEDULE_TASK` - Shift a task deadline

---

## 🔐 Authentication

### Flow

1. **Registration** → Email + password → User + UserProfile created
2. **Login** → Validate credentials → Sign JWT tokens
3. **Token Storage** → Access token (15 min) + Refresh token (7 days) in HTTP-only cookies
4. **Token Refresh** → Automatic refresh via frontend API client
5. **Token Versioning** → `tokenVersion` field prevents replay attacks

### Security Features

- ✅ Password hashing with bcrypt (10 rounds)
- ✅ JWT token versioning (invalidate all tokens on logout)
- ✅ HTTP-only cookies (XSS protection)
- ✅ SameSite cookies (CSRF protection)
- ✅ Automatic token refresh (seamless UX)

---

## 📊 Database Schema

### Core Tables

- **User** - User accounts
- **UserProfile** - Personalization settings (tone, verbosity, emoji)
- **Conversation** - Index sessions (DAILY or AD_HOC)
- **Message** - Individual messages with role (USER/ASSISTANT/SYSTEM)
- **Memory** - Long-term facts with vector embeddings (pgvector)
- **Task** - User tasks with status, priority, deadline
- **Goal** - Short/medium/long-term goals
- **Day** - Daily context (START/ACTIVE/END states)
- **ActionCandidate** - AI-suggested actions awaiting confirmation
- **ActionExecutionLog** - Audit trail of executed actions
- **DayInsight** - Daily score and summary metrics
- **NudgeEvent** - Logged adaptive nudges for the daily engine
- **DigestTopic** - Normalized digest topics
- **DigestSubscription** - Info digest topic subscriptions
- **AiLog** - AI interaction logs for debugging

### Key Relationships

```
User
  ├─→ UserProfile (1:1)
  ├─→ Conversations (1:many)
  ├─→ Tasks (1:many)
  ├─→ Goals (1:many)
  ├─→ Days (1:many)
  └─→ Memories (1:many)

Conversation
  ├─→ Messages (1:many)
  ├─→ Day (many:1)
  └─→ ActionCandidates (1:many)

Task
  ├─→ Parent Task (self-referential)
  ├─→ Goal (many:1)
  └─→ Day (many:1)
```

---

## 🐳 Docker Deployment

### Development

```bash
# Start all services
docker compose -f compose.dev.yaml up --build

# Access:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:4000
# - PostgreSQL: localhost:5432
```

### Production

```bash
# Build production images
docker build -f infra/docker/api.prod.Dockerfile -t pma-api:latest .
docker build -f infra/docker/web.prod.Dockerfile -t pma-web:latest .

# Run with docker-compose
docker compose up -d
```

---

## 📁 Key Files

| File                                            | Purpose                          |
| ----------------------------------------------- | -------------------------------- |
| `pnpm-workspace.yaml`                           | Defines workspace packages       |
| `turbo.json`                                    | Turborepo pipeline configuration |
| `apps/api/prisma/schema.prisma`                 | Database schema definition       |
| `apps/api/src/main.ts`                          | NestJS bootstrap & global config |
| `apps/web/src/app/layout.tsx`                   | Next.js root layout              |
| `packages/ai-core/src/ai.service.ts`            | Core AI orchestration            |
| `packages/ai-core/src/prompts/system.prompt.ts` | Prompt building logic            |

---

## 🧩 Package Dependencies

```
apps/web
  └─→ @ai/shared-types

apps/api
  ├─→ @ai/ai-core
  └─→ @ai/shared-types

@ai/ai-core
  └─→ @ai/shared-types

@ai/shared-types
  └─→ (no dependencies)
```

---

## 🛠️ Troubleshooting

### Common Issues

**1. Database Connection Error**

```bash
# Ensure PostgreSQL is running
docker compose -f compose.dev.yaml ps

# Check DATABASE_URL in apps/api/.env
echo $DATABASE_URL
```

**2. Prisma Client Not Generated**

```bash
cd apps/api
pnpm prisma generate
```

**3. Ollama Not Available**

```bash
# Check Ollama is running
curl http://localhost:11434/api/version

# Or use OpenAI instead
# Set OPENAI_API_KEY in apps/api/.env
```

**4. Port Already in Use**

```bash
# Find process using port 4000
lsof -i :4000
kill -9 <PID>
```

**5. CORS Errors**

Ensure `CORS_ORIGIN` in `apps/api/.env` matches your frontend URL:

```env
CORS_ORIGIN="http://localhost:3000"
```

---

## 📚 Additional Documentation

- [Architecture Overview](docs/architecture.md) - Detailed system design
- [API Specification](./docs/specification.md) - Full technical spec
- [Project Roadmap](./docs/roadmap.md) - Future plans
- [Project Idea](./docs/idea.md) - Original concept

---

## 🤝 Contributing

### Development Guidelines

1. **Code Style**: Use ESLint + Prettier (auto-format on save)
2. **Commits**: Follow conventional commits (`feat:`, `fix:`, `docs:`)
3. **Type Safety**: Ensure all TypeScript compiles (`pnpm typecheck`)
4. **Database Changes**: Create migrations (`pnpm prisma migrate dev`)
5. **Testing**: Run tests before committing (when available)

### Adding a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes
# 3. Check types
pnpm typecheck

# 4. Lint & format
pnpm lint:fix
pnpm format:fix

# 5. Test locally
pnpm dev

# 6. Commit & push
git add .
git commit -m "feat: add my feature"
git push origin feature/my-feature
```

---

## 📜 License

To be defined.

---

## 🙏 Acknowledgments

- **NestJS** - Backend framework
- **Next.js** - React framework
- **Prisma** - Database ORM
- **Turborepo** - Monorepo build system
- **Ollama** - Local LLM runtime

---

**MIRA is about empowering individuals — not automating them away.**

For questions or support, please open an issue on GitHub.
