# Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Breakdown](#component-breakdown)
4. [Data Flow Patterns](#data-flow-patterns)
5. [Key Design Decisions](#key-design-decisions)
6. [Security Architecture](#security-architecture)
7. [AI System Design](#ai-system-design)
8. [Database Design](#database-design)
9. [API Design](#api-design)
10. [Known Issues & Technical Debt](#known-issues--technical-debt)

---

## System Overview

### Purpose

PMA (Personal Manager Assistant) is a **stateful, context-aware AI assistant** designed to help individuals manage their daily life through:

- Intelligent task and goal management
- Long-term memory using vector embeddings (RAG)
- Multi-mode conversational interface
- AI-suggested actions with user confirmation
- Daily lifecycle management (start/end day with reflections)

### Core Principles

1. **Individual-first** - One user, one personal context
2. **Stateful by design** - Long-term memory persists across sessions
3. **User autonomy** - AI suggests, user decides
4. **Framework separation** - AI logic independent of backend framework
5. **Type safety** - End-to-end TypeScript with runtime validation

---

## High-Level Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│              Next.js 16 (React 19 + App Router)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Auth Pages   │  │ Chat UI      │  │ Management   │       │
│  │ (SSR)        │  │ (Streaming)  │  │ (Tasks/Goals)│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└────────────────────────────┬────────────────────────────────┘
                             │ REST API + SSE
                             ↓
┌────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                        │
│                  NestJS (Node.js Backend)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               Controllers (HTTP Handlers)            │  │
│  │  Authentication | Conversations | Tasks | etc.       │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                  │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │              Services (Business Logic)               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐   │  │
│  │  │Conversations │  │    Memory    │  │  Actions  │   │  │
│  │  │Orchestrator  │  │ (RAG System) │  │ Executor  │   │  │
│  │  └──────┬───────┘  └──────┬───────┘  └────┬──────┘   │  │
│  │         │                 │               │          │  │
│  │  ┌──────▼──────┐   ┌──────▼───────┐  ┌────▼─────┐    │  │
│  │  │ AI Adapter  │   │  Embeddings  │  │  Tasks   │    │  │
│  │  │ (Type Map)  │   │   Service    │  │  Service │    │  │
│  │  └──────┬──────┘   └──────────────┘  └──────────┘    │  │
│  └─────────┼────────────────────────────────────────────┘  │
└────────────┼───────────────────────────────────────────────┘
             │
             ↓
┌────────────────────────────────────────────────────────────┐
│                    AI CORE LAYER                           │
│          Framework-Agnostic AI Logic (@ai/ai-core)         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              AiService (Orchestrator)                │  │
│  └────┬──────────────┬─────────────┬────────────────────┘  │
│       │              │             │                       │
│  ┌────▼────┐  ┌──────▼──────┐  ┌───▼──────┐                │
│  │ Prompts │  │  Providers  │  │  Memory  │                │
│  │ Builder │  │  (Ollama/   │  │ Extractor│                │
│  │         │  │   OpenAI)   │  │          │                │
│  └─────────┘  └───────┬─────┘  └──────────┘                │
└───────────────────────┼────────────────────────────────────┘
                        │ HTTP/API
                        ↓
              ┌────────────────────┐
              │   LLM Provider     │
              │  (Ollama/OpenAI)   │
              └────────────────────┘

┌───────────────────────────────────────────────────────────┐
│                  PERSISTENCE LAYER                        │
│  ┌──────────────────────┐  ┌───────────────────────────┐  │
│  │   PostgreSQL         │  │    pgvector Extension     │  │
│  │   (Relational Data)  │  │  (Vector Embeddings)      │  │
│  └──────────────────────┘  └───────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### Frontend (apps/web)

**Technology**: Next.js 16 with App Router, React 19, TypeScript, Tailwind CSS v4

**Key Components**:

| Component      | File                                       | Purpose                                      |
| -------------- | ------------------------------------------ | -------------------------------------------- |
| Chat UI        | `src/components/chat.tsx`                  | Real-time streaming chat with action buttons |
| Task List      | `src/components/tasks-list.tsx`            | Task management interface                    |
| Goal List      | `src/components/goals-list.tsx`            | Goal tracking interface                      |
| Memory Browser | `src/components/memory-list.tsx`           | View stored memories                         |
| Auth Forms     | `src/components/login.tsx`, `register.tsx` | Authentication UI                            |
| API Client     | `src/lib/api/client.ts`                    | Centralized API communication                |

**Routing Structure**:

```
/                         # Landing page
/auth/login               # Login page
/auth/register            # Registration page
/auth/onboarding          # Initial setup wizard
/me                       # Dashboard (protected)
/me/chat                  # Main chat interface
/me/chat/[id]             # Specific conversation
/me/conversations         # Conversation history
/me/tasks                 # Task management
/me/goals                 # Goal management
/me/memory                # Memory browser
/me/profile               # User settings
/me/info-digests          # Digest subscriptions
/me/logs                  # AI interaction logs
```

**State Management**:

- Local component state (React hooks)
- No global state library (keeps it simple)
- Server-side state via Next.js Server Components

**API Communication**:

- REST API via `fetch`
- JWT tokens in HTTP-only cookies
- Automatic token refresh on 401 responses
- Server-Sent Events (SSE) for streaming

---

### Backend (apps/api)

**Technology**: NestJS, Prisma ORM, PostgreSQL

#### Module Structure

```
src/
├── auth/                            # Authentication & authorization
│   ├── auth.service.ts              # Login, register, token management
│   ├── jwt.strategy.ts              # JWT validation strategy
│   └── jwt.guard.ts                 # Route protection
│
├── users/                           # User management
│   ├── users.service.ts             # CRUD operations
│   └── dto/                         # Update profile DTOs
│
├── conversations/                   # Chat orchestration (PRIMARY ORCHESTRATOR)
│   ├── conversations.service.ts     # 812 lines - handles full message lifecycle
│   ├── conversations.controller.ts
│   └── (orchestrates 9 services)
│
├── ai/                              # AI service adapter
│   ├── ai.service.ts                # Type mapping layer (Prisma → ai-core)
│   └── ai.module.ts
│
├── memory/                          # RAG memory system
│   ├── memory.service.ts            # CRUD operations
│   ├── memory-ingestion.service.ts  # Store memories with embeddings
│   ├── memory-retriever.service.ts  # Vector search
│   └── dto/memory-candidate.dto.ts
│
├── embeddings/                      # Vector embedding generation
│   ├── embeddings.service.ts        # Stub implementation (returns zeros)
│   └── embeddings.interface.ts
│
├── actions/                         # AI action system
│   ├── actions.service.ts           # Store & confirm actions
│   ├── action-executor.service.ts   # Execute confirmed actions
│   └── dto/confirm-action.dto.ts
│
├── intents/                         # Fallback intent detection
│   └── intent-detector.service.ts   # Pattern-based action detection
│
├── tasks/                           # Task management
│   ├── tasks.service.ts
│   ├── tasks.controller.ts
│   └── dto/                         # Create/Update DTOs
│
├── goals/                           # Goal management
│   ├── goals.service.ts
│   └── dto/
│
├── days/                            # Daily lifecycle
│   └── days.service.ts              # Start/end day, get summary
│
├── digest/                          # Information digest subscriptions
│   └── digest.service.ts
│
├── search/                          # External search integration
│   └── search.service.ts            # For INFO mode
│
├── reflection/                      # End-of-day reflections
│   └── reflection.service.ts
│
├── logs/                            # AI interaction logging
│   └── logs.service.ts
│
└── prisma/                          # Database access
    ├── prisma.service.ts            # Prisma client wrapper
    └── types.ts                     # Custom types
```

#### Service Responsibilities

| Service                  | Single Responsibility                  | Dependencies                             |
| ------------------------ | -------------------------------------- | ---------------------------------------- |
| `AuthService`            | User authentication & token management | PrismaService, JwtService                |
| `ConversationsService`   | **Message lifecycle orchestration**    | 9 services (HIGH COUPLING)               |
| `AiService`              | Type mapping (Prisma → ai-core)        | ConfigService                            |
| `MemoryIngestionService` | Store memory with embeddings           | PrismaService, EmbeddingsService         |
| `MemoryRetrieverService` | Vector similarity search               | PrismaService                            |
| `ActionsService`         | Store & confirm action candidates      | PrismaService, ActionExecutorService     |
| `ActionExecutorService`  | Execute confirmed actions              | TasksService, DaysService, DigestService |
| `TasksService`           | Task CRUD operations                   | PrismaService                            |
| `IntentDetectorService`  | Pattern-based action detection         | None (stateless)                         |

---

### AI Core Package (packages/ai-core)

**Purpose**: Framework-agnostic AI logic that can be used in any context (backend, CLI, serverless, etc.)

**Philosophy**:

- ✅ Zero dependencies on NestJS, Express, etc.
- ✅ Pure TypeScript with exported types
- ✅ Provider-pluggable (easily add new LLM providers)
- ✅ Testable in isolation

**Structure**:

```typescript
// packages/ai-core/src/

ai.service.ts                    // Main orchestrator
  ├─→ buildSystemPrompt()        // Mode + profile + memories + context
  ├─→ generateResponse()         // Synchronous generation
  ├─→ generateResponseStream()   // Token streaming
  └─→ parseStructuredResponse()  // Extract actions/memories

providers/
  ├─→ llm.provider.interface.ts  // Provider contract
  ├─→ ollama.provider.ts         // Local LLM
  └─→ openai.provider.ts         // Cloud LLM

prompts/
  ├─→ system.prompt.ts           // Context-aware prompt builder
  ├─→ mode.prompts.ts            // Mode-specific instructions
  ├─→ info-digest.prompts.ts     // INFO mode prompts
  └─→ message.formatter.ts       // Format conversation history

memory/
  └─→ extractor.ts               // Heuristic memory extraction

types/
  └─→ index.ts                   // Core types (ConversationContext, etc.)
```

**Key Abstractions**:

```typescript
// Provider interface
interface LlmProvider {
  generate(request: LlmRequest): Promise<LlmResponse>;
  generateStream?(request: LlmRequest): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
  getName(): string;
}

// Request/Response
interface LlmRequest {
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

interface LlmResponse {
  content: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

// AI Response
interface AiResponse {
  content: string;
  actionCandidates?: ActionCandidate[];
  memoryCandidates?: MemoryCandidate[];
  summary?: string;
}
```

---

## Data Flow Patterns

### Flow 1: User Sends Chat Message

**Step-by-Step Flow**:

```
1. USER INTERACTION
   Browser → Chat Component (chat.tsx)
   - User types message
   - Clicks send button

2. FRONTEND API CALL
   Chat Component → API Client (lib/api/conversations.ts)
   - sendMessageStream(message, conversationId?)
   - Opens EventSource for SSE

3. HTTP REQUEST
   Frontend → Backend Controller
   POST /api/conversations/message/stream
   Body: { message: string, conversationId?: string, mode?: string }
   Cookie: accessToken (JWT)

4. AUTHENTICATION
   JwtAuthGuard → JwtStrategy.validate()
   - Extract JWT from cookie
   - Verify signature & expiration
   - Check tokenVersion in DB
   - Inject userId into request

5. CONTROLLER HANDLER
   ConversationsController.sendMessageStream()
   - Setup SSE headers (Content-Type: application/x-ndjson)
   - Create emit() function for streaming

6. ORCHESTRATION START
   ConversationsService.handleMessage()

   A. Context Acquisition:
      ├─→ Get/create conversation (daily or ad-hoc)
      ├─→ MemoryRetrieverService.retrieve()
      │    └─→ Vector search: SELECT * WHERE embedding <-> query_embedding < threshold
      ├─→ Fetch today's tasks (TODO + IN_PROGRESS)
      ├─→ Fetch backlog tasks
      └─→ Get day context (date, state)

   B. Mode Detection:
      ├─→ Check if INFO mode triggered (keywords: "search", "find info about")
      └─→ Check if REFLECTION mode triggered (keywords: "reflect", "summarize")

   C. Save User Message:
      └─→ prisma.message.create({ role: 'USER', content: message })

7. AI SERVICE ADAPTER
   AiService.generateResponseStream()
   - Map Prisma types → ai-core types:
     * ConversationMode (Prisma enum) → ConversationMode (ai-core enum)
     * Message (Prisma) → Message (ai-core)
     * UserProfile → { displayName, tone, verbosity, useEmoji }
     * Memory → { content, importance, tags }

8. AI CORE PROCESSING
   CoreAiService.generateResponseStream()

   A. Build System Prompt:
      buildSystemPrompt(context)
      ├─→ Add mode-specific instructions
      │    MANAGER: "You are a productivity assistant..."
      │    REFLECTION: "Help the user reflect on their day..."
      ├─→ Add user profile adaptation
      │    Tone: friendly → use warm language
      │    Verbosity: short → keep responses concise
      │    UseEmoji: true → add relevant emoji
      ├─→ Add memory context
      │    "Remember: User prefers morning meetings"
      ├─→ Add task context
      │    "Today's tasks: [Task 1, Task 2]"
      └─→ Add day context
           "Current time: Morning (9:00 AM)"

   B. Format Message History:
      messagesToLlmFormat(context.messages)
      └─→ Convert to LLM-specific format

   C. Call LLM Provider:
      provider.generateStream(llmRequest)
      ├─→ Send HTTP request to Ollama/OpenAI
      └─→ Yield tokens via AsyncGenerator

9. STREAMING TOKENS
   CoreAiService → AiService → ConversationsService → Controller
   - Each token flows back through the chain
   - Controller emits: { type: 'delta', delta: token }
   - Frontend receives SSE event
   - Chat component appends character-by-character

10. RESPONSE PARSING
    After streaming completes:
    parseStructuredResponse(fullContent)
    ├─→ Check if content is JSON-formatted
    ├─→ Extract actionCandidates[] if present
    ├─→ Extract memoryCandidates[] if present
    ├─→ Fallback: extractMemoryCandidates() (heuristic)
    └─→ Return AiResponse object

11. POST-PROCESSING (Backend)
    ConversationsService continues:

    A. Save Assistant Message:
       prisma.message.create({
         role: 'ASSISTANT',
         content: aiResponse.content
       })

    B. Handle Actions:
       if (actionCandidates.length > 0) {
         ActionsService.createCandidates()
         └─→ Store in DB with status: PENDING
       }

    C. Ingest Memories:
       if (memoryCandidates.length > 0) {
         MemoryIngestionService.ingest()
         ├─→ Filter: confidence >= 0.7, importance >= 5
         ├─→ Generate embeddings (EmbeddingsService.embed())
         └─→ Store with vector: INSERT INTO Memory (embedding)
       }

    D. Log Interaction:
       LogsService.logInteraction()
       └─→ Store prompt + response + actions for debugging

12. FINAL RESPONSE
    Controller emits:
    {
      type: 'complete',
      conversationId: '...',
      message: MessageDto,
      actions: ActionCandidate[]
    }

13. FRONTEND UPDATE
    Chat Component receives 'complete' event:
    - Finalize message rendering
    - Display action buttons (if actions present)
    - Scroll to bottom
    - Enable input field
```

---

### Flow 2: User Confirms Action

```
1. USER CLICKS "CONFIRM"
   Chat Component → confirmAction(actionId)

2. HTTP REQUEST
   POST /api/actions/confirm
   Body: { actionId: string }
   Cookie: accessToken

3. ACTIONS SERVICE
   ActionsService.confirmAction(userId, actionId)

   A. Fetch & Verify:
      ├─→ prisma.actionCandidate.findFirst({ id, userId })
      └─→ Ensure action belongs to user (authorization)

   B. Check Status:
      if (status === 'EXECUTED') return early

   C. Update Status:
      prisma.actionCandidate.update({ status: 'CONFIRMED' })

4. ACTION EXECUTOR
   ActionExecutorService.execute(userId, action)

   switch (action.type) {
     case 'TASK_CREATE':
       TasksService.create(userId, {
         name: action.payload.name,
         priority: action.payload.priority,
         source: 'CHAT'
       })

     case 'TASK_UPDATE_STATUS':
       TasksService.updateStatus(userId, taskId, newStatus)

     case 'DAY_START':
       DaysService.startDay(userId, date)
       ├─→ Update day.state = 'ACTIVE'
       └─→ Set day.startedAt = NOW()

     case 'DAY_END':
       DaysService.endDay(userId, date)
       ├─→ Update day.state = 'END'
       ├─→ Set day.endedAt = NOW()
       └─→ Trigger reflection generation
   }

5. SUCCESS PATH
   A. Update Action:
      prisma.actionCandidate.update({ status: 'EXECUTED' })

   B. Log Execution:
      prisma.actionExecutionLog.create({
        actionId,
        userId,
        type: action.type,
        status: 'SUCCESS'
      })

   C. Return Success:
      { actionId, status: 'EXECUTED' }

6. ERROR PATH
   A. Update Action:
      prisma.actionCandidate.update({ status: 'FAILED' })

   B. Log Error:
      prisma.actionExecutionLog.create({
        actionId,
        status: 'FAILED',
        error: errorMessage
      })

   C. Throw Exception:
      BadRequestException(errorMessage)

7. FRONTEND UPDATE
   - Update action button state (show checkmark or error)
   - Optionally refresh task list
   - Show toast notification
```

---

### Flow 3: Memory Retrieval (RAG)

```
1. TRIGGER
   User sends message → ConversationsService.handleMessage()

2. VECTOR SEARCH
   MemoryRetrieverService.retrieve(userId, query, limit = 5)

   A. Generate Query Embedding:
      queryEmbedding = await this.embeddings.embed(query)
      // Returns: number[] (1536 dimensions)

   B. Vector Similarity Search:
      await this.prisma.$queryRaw`
        SELECT
          id, content, importance, tags, type, source,
          1 - (embedding <-> ${queryEmbedding}::vector) AS similarity
        FROM "Memory"
        WHERE "userId" = ${userId}::uuid
          AND embedding IS NOT NULL
        ORDER BY embedding <-> ${queryEmbedding}::vector
        LIMIT ${limit}
      `
      // <-> is cosine distance operator (pgvector)
      // Returns memories sorted by semantic similarity

   C. Return Memories:
      memories.map(m => ({
        content: m.content,
        importance: m.importance,
        tags: m.tags
      }))

3. CONTEXT BUILDING
   ConversationContext includes:
   {
     memories: [
       { content: "User prefers morning meetings", importance: 8, tags: ["preference"] },
       { content: "User works on Project X", importance: 7, tags: ["work"] }
     ],
     ...
   }

4. PROMPT INJECTION
   buildSystemPrompt(context)
   └─→ Adds memory section:
       "Remember these facts about the user:
        - User prefers morning meetings (importance: 8)
        - User works on Project X (importance: 7)"

5. LLM GENERATION
   LLM receives context → generates personalized response
   Example:
   User: "Schedule a meeting with Bob"
   AI: "I'll schedule it in the morning since you prefer morning meetings."
```

---

## Key Design Decisions

### Decision 1: Monorepo Architecture

**Rationale**:

- ✅ Code sharing between frontend and backend (shared-types)
- ✅ Consistent versioning across packages
- ✅ Single source of truth for builds (Turborepo)
- ✅ Easier refactoring (update types in one place)

**Trade-offs**:

- ❌ Larger repository size
- ❌ Requires workspace-aware tooling (pnpm, Turborepo)
- ✅ But: Outweighed by DX benefits

---

### Decision 2: Framework-Agnostic AI Core

**Rationale**:
Extract AI logic into a separate package (`@ai/ai-core`) with:

- ✅ Zero dependencies on NestJS/Express
- ✅ Provider abstraction (easy to swap LLMs)
- ✅ Testable in isolation
- ✅ Reusable in other contexts (CLI tools, edge functions)

**Implementation**:

```
@ai/ai-core (pure TypeScript)
  ↑
  │ (adapter layer)
  │
apps/api/src/ai/ai.service.ts (type mapping)
  ↑
  │
ConversationsService (orchestration)
```

**Alternative Considered**: Keep AI logic in backend directly

- ❌ Would tightly couple AI to NestJS
- ❌ Harder to test
- ❌ Cannot reuse in other projects

---

### Decision 3: Type Mapping Layer

**Problem**: Prisma generates enums, but they don't match ai-core enums exactly.

**Solution**: Create adapter service that maps types:

```typescript
// apps/api/src/ai/ai.service.ts
private mapConversationMode(mode: ConversationMode): CoreConversationMode {
  return mode as unknown as CoreConversationMode;
}

private mapMessage(message: Message): CoreMessage {
  return {
    role: this.mapMessageRole(message.role),
    content: message.content,
  };
}
```

**Trade-offs**:

- ❌ Additional code to maintain
- ✅ But: Clear boundary between persistence and business logic
- ✅ Allows ai-core to remain framework-agnostic

**Alternative Considered**: Share enums from single source

- Would require Prisma to import from `@ai/shared-types`
- Prisma doesn't support external enum imports well
- Chose mapping layer for pragmatism

---

### Decision 4: Action Confirmation Pattern

**Rationale**:
AI-suggested actions require **user confirmation** before execution to:

- ✅ Prevent unwanted actions (safety)
- ✅ Give users control (autonomy principle)
- ✅ Build trust through transparency

**Flow**:

```
AI suggests → Store as PENDING → User confirms → Execute → Mark EXECUTED
```

**Alternative Considered**: Auto-execute low-confidence actions

- ❌ Too risky (could create unwanted tasks)
- Chose explicit confirmation for MVP

---

### Decision 5: Vector Database via pgvector

**Rationale**:
Use PostgreSQL + pgvector extension instead of dedicated vector DB:

- ✅ Single database (no additional infrastructure)
- ✅ ACID transactions (consistency with relational data)
- ✅ Mature ecosystem (Prisma ORM support)
- ✅ Cost-effective for MVP scale

**Trade-offs**:

- ❌ Not optimized for massive vector scale (100M+ vectors)
- ✅ But: Sufficient for personal assistant use case (<10K memories per user)

**Alternative Considered**: Pinecone, Weaviate, Milvus

- Would require separate service
- Added complexity for MVP
- May revisit for scale

---

### Decision 6: Streaming-First Chat

**Rationale**:
Stream LLM tokens character-by-character instead of waiting for full response:

- ✅ Better perceived performance
- ✅ Users see response forming (engaging)
- ✅ Can interrupt long responses

**Implementation**:

- Backend: Server-Sent Events (SSE) via newline-delimited JSON
- Frontend: EventSource API with character buffering

**Trade-offs**:

- ❌ More complex implementation
- ❌ Harder to handle errors mid-stream
- ✅ But: Significantly better UX

---

### Decision 7: Conversation Modes

**Rationale**:
Different modes for different contexts:

- **MANAGER**: Task planning (action-oriented prompts)
- **REFLECTION**: End-of-day summaries (introspective prompts)
- **COMPANION**: Supportive dialogue (empathetic prompts)
- **INFO**: Information digests (factual prompts)

**Implementation**:
Each mode has custom system prompt template in `packages/ai-core/src/prompts/mode.prompts.ts`

**Alternative Considered**: Single "smart" prompt

- ❌ Would require LLM to infer intent every time
- ❌ Less predictable behavior
- Chose explicit modes for consistency

---

### Decision 8: JWT + Refresh Token Pattern

**Rationale**:

- Access token (15 min) - Short-lived, in HTTP-only cookie
- Refresh token (7 days) - Long-lived, in HTTP-only cookie
- Token versioning field (`tokenVersion`) - Invalidate all tokens on logout

**Security Benefits**:

- ✅ HTTP-only cookies prevent XSS attacks
- ✅ Short access token lifetime limits exposure
- ✅ Token versioning prevents replay attacks
- ✅ Automatic refresh keeps UX smooth

**Alternative Considered**: Session-based auth

- Would require Redis or DB sessions
- Chose JWT for stateless scalability

---

## Security Architecture

### Authentication Flow

```
1. Registration:
   Email + Password → bcrypt hash (10 rounds) → Store in DB
   └─→ Create UserProfile with defaults

2. Login:
   Email + Password → Validate hash → Sign JWT tokens
   ├─→ Access Token (15 min): { sub: userId, tv: tokenVersion }
   └─→ Refresh Token (7 days): { sub: userId, tv: tokenVersion }

3. Token Storage:
   Set HTTP-only cookies:
   ├─→ accessToken (SameSite=Lax, Secure, HttpOnly)
   └─→ refreshToken (SameSite=Lax, Secure, HttpOnly)

4. Authenticated Requests:
   Request → JwtAuthGuard → JwtStrategy.validate()
   ├─→ Extract JWT from cookie
   ├─→ Verify signature (JWT_SECRET)
   ├─→ Check expiration
   ├─→ Query DB: user.tokenVersion === token.tv?
   └─→ Inject { id: userId } into req.user

5. Token Refresh:
   Access token expired (401) → Frontend calls /api/auth/refresh
   ├─→ Verify refresh token
   ├─→ Check tokenVersion in DB
   ├─→ Sign new access token
   └─→ Return new cookies

6. Logout:
   Increment user.tokenVersion in DB
   └─→ Invalidates ALL tokens (forces re-login)
```

### Authorization Pattern

**Resource-level authorization** via `userId` checks:

```typescript
// Example: TasksService.findOne()
async findOne(userId: string, id: string) {
  const task = await this.prisma.task.findFirst({
    where: { id, userId },  // ← Ensures task belongs to user
  });

  if (!task) {
    throw new NotFoundException('Task not found');
  }

  return task;
}
```

**Pattern**: Every service method accepts `userId` as first parameter and validates ownership.

---

### Input Validation

**Layer 1: Global ValidationPipe** (`apps/api/src/main.ts:11-16`)

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // Strip unknown properties
    forbidNonWhitelisted: true, // Reject unknown properties
    transform: true, // Auto-convert types (string → number)
  }),
);
```

**Layer 2: DTO Validation** (class-validator decorators)

```typescript
export class CreateTaskDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
```

**Layer 3: Business Logic Validation**

```typescript
// Example: Prevent circular task references
if (updateTaskDto.parentId === taskId) {
  throw new Error('Task cannot be its own parent');
}
```

---

### CORS Configuration

```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true, // Allow cookies
});
```

---

## AI System Design

### Prompt Engineering

**System Prompt Structure**:

```
[Role Definition]
You are a personal assistant helping with [MODE-SPECIFIC PURPOSE].

[User Profile Adaptation]
- Communication tone: [friendly/professional/casual]
- Response style: [short/medium/detailed]
- Use emoji: [yes/no]

[Context Section]
Current date: [DATE]
Day state: [START/ACTIVE/END]

[Memory Section - Only if memories exist]
Remember these facts about the user:
- [Memory 1] (importance: 8)
- [Memory 2] (importance: 7)

[Task Context - Only if tasks exist]
Today's tasks:
- [Task 1] (status: TODO, priority: HIGH)
- [Task 2] (status: IN_PROGRESS, priority: MEDIUM)

[Action Instructions]
You can suggest actions by returning JSON with this structure:
{
  "text": "Your response",
  "actions": [
    {
      "type": "TASK_CREATE",
      "payload": {"name": "...", "priority": "HIGH"},
      "confidence": 0.9
    }
  ]
}
```

**Mode-Specific Prompts** (`packages/ai-core/src/prompts/mode.prompts.ts`):

```typescript
export const MODE_INSTRUCTIONS = {
  MANAGER: `
    Focus on productivity and task management.
    Help the user:
    - Break down goals into actionable tasks
    - Prioritize work effectively
    - Stay organized and on track
  `,

  REFLECTION: `
    Help the user reflect on their day.
    Focus on:
    - What went well
    - What could be improved
    - Patterns and insights
    - Emotional processing
  `,

  COMPANION: `
    Be a supportive, empathetic conversation partner.
    Listen actively and:
    - Provide emotional support
    - Ask thoughtful questions
    - Offer encouragement
  `,

  INFO: `
    Provide concise, factual information.
    Focus on:
    - Summarizing search results
    - Presenting key facts
    - Maintaining neutrality
  `,
};
```

---

### Memory Extraction Algorithm

**Heuristic-based extraction** (`packages/ai-core/src/memory/extractor.ts`):

```typescript
export function extractMemoryCandidates(
  userMessage: string,
  assistantResponse: string,
  mode: ConversationMode,
  existingMemories: Memory[],
): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];

  // Pattern 1: Explicit statements ("I prefer...", "I usually...")
  const preferencePatterns = [/I prefer (.*)/i, /I usually (.*)/i, /I like to (.*)/i];

  // Pattern 2: REFLECTION mode insights
  if (mode === ConversationMode.REFLECTION) {
    // Extract insights from assistant's summary
  }

  // Pattern 3: Factual statements from user
  const factPatterns = [/My (.*) is (.*)/i, /I work (.*)/i];

  // Assign importance scores (1-10)
  // Assign confidence scores (0-1)

  return candidates;
}
```

**LLM-based extraction** (structured response):

```json
{
  "text": "I've noted your preference...",
  "memoryCandidates": [
    {
      "content": "User prefers meetings in the morning",
      "type": "FACTUAL",
      "importance": 8,
      "tags": ["preference", "schedule", "meetings"],
      "confidence": 0.95
    }
  ]
}
```

**Filtering criteria** (`apps/api/src/memory/memory-ingestion.service.ts:24-26`):

```typescript
const curated = candidates.filter(
  c => c.confidence >= 0.7 && c.importance >= 5 && c.content.length > 10,
);
```

---

## Database Design

### Schema Overview

**Core Entities**:

```
User (1) ←─────→ (1) UserProfile
  │
  ├─→ (many) Conversations
  │     └─→ (many) Messages
  │
  ├─→ (many) Tasks
  │     ├─→ (1?) Parent Task (self-ref)
  │     ├─→ (1?) Goal
  │     └─→ (1?) Day
  │
  ├─→ (many) Goals
  │     └─→ (1?) Parent Goal (self-ref)
  │
  ├─→ (many) Days
  │
  ├─→ (many) Memories (with vector embeddings)
  │
  ├─→ (many) ActionCandidates
  │     └─→ (many) ActionExecutionLogs
  │
  └─→ (many) DigestSubscriptions
        └─→ (1) DigestTopic
```

**Key Indexes**:

```sql
-- User lookups
CREATE UNIQUE INDEX ON "User"(email);

-- Conversation queries
CREATE INDEX ON "Conversation"("userId", "state", "type");
CREATE UNIQUE INDEX ON "Conversation"("userId", "type", "date");

-- Message retrieval
CREATE INDEX ON "Message"("conversationId", "createdAt");

-- Memory vector search
CREATE INDEX ON "Memory" USING ivfflat (embedding vector_cosine_ops);

-- Task filtering
CREATE INDEX ON "Task"("userId", "status");
CREATE INDEX ON "Task"("dayId");

-- Action tracking
CREATE INDEX ON "ActionCandidate"("userId", "status");
```

**Vector Search Performance**:

pgvector uses IVFFlat index for approximate nearest neighbor search:

- Trade-off: Speed vs. accuracy
- Suitable for <1M vectors per table
- Cosine distance operator: `<->`

---

## API Design

### RESTful Endpoints

**Authentication**:

```
POST   /api/auth/register       # Create account
POST   /api/auth/login          # Sign in
POST   /api/auth/refresh        # Refresh access token
POST   /api/auth/logout         # Invalidate tokens
```

**Conversations**:

```
GET    /api/conversations              # List conversations
GET    /api/conversations/daily        # Get/create daily conversation
GET    /api/conversations/:id          # Get specific conversation
POST   /api/conversations/message      # Send message (sync)
POST   /api/conversations/message/stream  # Send message (streaming)
POST   /api/conversations/ad-hoc       # Create ad-hoc conversation
PATCH  /api/conversations/:id/mode     # Switch mode
PATCH  /api/conversations/:id/archive  # Archive conversation
```

**Tasks**:

```
GET    /api/tasks              # List tasks
GET    /api/tasks/:id          # Get task
POST   /api/tasks              # Create task
PATCH  /api/tasks/:id          # Update task
DELETE /api/tasks/:id          # Delete task
```

**Actions**:

```
POST   /api/actions/confirm    # Confirm & execute action
```

**Memory**:

```
GET    /api/memory             # List memories
DELETE /api/memory/:id         # Delete memory
```

**Streaming Protocol** (SSE):

```
Event format: newline-delimited JSON

{ "type": "start" }
{ "type": "delta", "delta": "H" }
{ "type": "delta", "delta": "e" }
{ "type": "delta", "delta": "l" }
...
{ "type": "complete", "conversationId": "...", "message": {...}, "actions": [...] }
```

---

## Known Issues & Technical Debt

### P0 - Critical

**Issue**: Relative path imports bypass package boundaries

```typescript
// apps/api/src/conversations/conversations.service.ts:4-10
import {
   buildSystemPrompt,
...
} from '../../../../packages/ai-core/src/index';
```

**Fix**: Use workspace alias `@ai/ai-core` and ensure package builds to `dist/`

---

### P1 - High Priority

**Issue**: ConversationsService has 9 dependencies (god service)

**Impact**: Hard to test, maintain, understand (812 lines)

**Fix**: Extract into specialized services:

- `ConversationContextBuilder`
- `ConversationModeDetector`
- `ConversationPostProcessor`
- `ConversationsOrchestrator` (thin coordinator)

---

### P2 - Medium Priority

**Issue**: DTO duplication between frontend and backend

**Fix**: Generate frontend types from backend OpenAPI spec

```bash
# Add @nestjs/swagger
# Generate openapi.json
# Use openapi-typescript-codegen to generate types
```

---

### P3 - Low Priority

**Issue**: Type duplication (Prisma enums vs. ai-core enums)

**Current State**: Acceptable with mapping layer

**Alternative**: Code generation from single source of truth

---

### Technical Debt

1. **EmbeddingsService** - Currently returns zeros (stub implementation)
   - Needs real implementation (OpenAI embeddings or local model)

2. **SearchService** - Needs real external search API integration
   - Current: Stub implementation

3. **Error Handling** - Inconsistent error handling across services
   - Standardize: NestJS exception filters

4. **Testing** - Minimal test coverage
   - Add: Unit tests, integration tests, e2e tests

5. **Logging** - Console.log statements scattered
   - Centralize: Winston or Pino logger

6. **Rate Limiting** - No rate limiting on API endpoints
   - Add: @nestjs/throttler

---

## Future Enhancements

1. **Scheduled Tasks** - Recurring tasks, deadline reminders
2. **Voice Input** - Speech-to-text integration
3. **Mobile App** - React Native frontend
4. **Plugins** - Third-party integrations (Calendar, Email, etc.)
5. **Multi-language** - i18n support
6. **Team Features** - Shared goals, collaborative tasks
7. **Advanced RAG** - Hierarchical memory, episodic memory
8. **Autonomous Actions** - Low-risk actions auto-executed
9. **Custom LLM Fine-tuning** - Train on user's patterns

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-14  
**Maintainer**: PMA Development Team
