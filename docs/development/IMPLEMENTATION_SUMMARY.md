# PMA Implementation Summary & Refactoring Suggestions

**Date:** January 2025  
**Phase:** v0.1 MVP - Base Architecture Setup  
**Status:** Core foundation implemented, RAG and AI Core packages pending

---

## 📊 Current Implementation Status

### ✅ **Implemented Components**

#### 1. **Database Schema (Prisma)**

- ✅ User model with authentication fields
- ✅ UserProfile model (displayName, tone, verbosity, useEmoji)
- ✅ Conversation model with modes (MANAGER, REFLECTION, COMPANION, INFO)
- ✅ Conversation state management (CREATED, ACTIVE, ARCHIVED)
- ✅ Conversation types (DAILY, AD_HOC)
- ✅ Message model with role-based messages
- ✅ Memory model (content, importance, tags)
- ✅ Proper indexes and relationships
- ⚠️ **Missing:** Vector embeddings field for Memory model (pgvector)

#### 2. **Authentication Module**

- ✅ JWT-based authentication
- ✅ Registration with password hashing (bcrypt)
- ✅ Login with credential validation
- ✅ Cookie-based token storage (accessToken, refreshToken)
- ✅ JWT Guard for protected routes
- ✅ JWT Strategy with cookie extraction
- ✅ DTOs with validation (RegisterDto, LoginDto)
- ⚠️ **Issues:**
  - Hardcoded JWT secret in `jwt.strategy.ts` (should use ConfigService)
  - No refresh token rotation mechanism
  - No token blacklisting for logout

#### 3. **Users Module**

- ✅ User profile retrieval (`/users/me`)
- ✅ User profile update endpoint
- ✅ Automatic UserProfile creation on registration
- ⚠️ **Issues:**
  - `update()` method uses `Partial<any>` instead of proper DTO
  - No validation for profile updates
  - Missing PrismaModule import in UsersModule

#### 4. **Conversations Module**

- ✅ Daily conversation management (one per day per user)
- ✅ Ad-hoc conversation creation
- ✅ Message handling with full lifecycle
- ✅ Conversation mode switching
- ✅ Conversation archiving
- ✅ Message history retrieval
- ✅ Context building for AI responses
- ✅ Memory candidate extraction and storage
- ⚠️ **Issues:**
  - Memory retrieval uses simple importance-based sorting, not vector similarity
  - No pagination for conversations list
  - `@ts-ignore` used in `handleMessage` method
  - Memory candidates extraction uses simple keyword matching (heuristic-based)

#### 5. **AI Service Module**

- ✅ Ollama integration
- ✅ Mode-specific prompts (MANAGER, REFLECTION, COMPANION, INFO)
- ✅ System prompt builder with user profile context
- ✅ Conversation history formatting
- ✅ Fallback stub responses on error
- ✅ Memory candidate extraction (heuristic-based)
- ⚠️ **Issues:**
  - Hardcoded Ollama URL and model in constructor
  - No LLM provider abstraction (tightly coupled to Ollama)
  - No streaming support
  - Memory extraction is keyword-based, not AI-powered
  - No retry logic or rate limiting
  - Error handling could be more granular

#### 6. **Backend Infrastructure**

- ✅ NestJS application structure
- ✅ Prisma service with connection pooling
- ✅ Global validation pipe
- ✅ CORS configuration
- ✅ Cookie parser middleware
- ✅ Global ConfigModule
- ⚠️ **Issues:**
  - JWT secret not using ConfigService
  - No environment variable validation
  - No health check endpoint
  - No request logging/monitoring

#### 7. **Frontend (Web)**

- ✅ Next.js App Router setup
- ✅ Auth pages (login/register)
- ✅ User profile pages
- ✅ Chat interface
- ✅ Conversations list
- ✅ API client setup
- ⚠️ **Status:** Implementation details not fully reviewed

---

## ❌ **Missing Components (Per Specification)**

### 1. **RAG/Vector Memory System**

- ❌ No pgvector extension setup in Prisma schema
- ❌ No embedding generation service
- ❌ No vector similarity search implementation
- ❌ Memory model lacks `embedding` field
- ❌ No retrieval logic based on semantic similarity
- **Current workaround:** Simple importance-based memory retrieval

### 2. **AI Core Package**

- ❌ `@ai/ai-core` package exists but is empty
- ❌ No prompt builder abstraction
- ❌ No LLM provider abstraction (OpenAI, Gemini, Ollama)
- ❌ No memory retrieval service
- ❌ No embeddings service
- **Current state:** AI logic is directly in `ai.service.ts`

### 3. **Shared Types Package**

- ❌ `@ai/shared-types` package exists but is empty
- ❌ No shared DTOs between frontend and backend
- ❌ No shared enums/types

### 4. **Tasks & Goals Management**

- ❌ No Task model in schema
- ❌ No Goal model in schema
- ❌ No task/goal endpoints
- **Note:** Specified in MVP scope but not implemented

### 5. **Onboarding Flow**

- ❌ No onboarding endpoints
- ❌ No onboarding state tracking
- **Note:** Specified in MVP scope but not implemented

### 6. **Daily Flow Features**

- ❌ No morning briefing generation
- ❌ No evening reflection prompts
- ❌ No daily planning assistance logic
- **Note:** Basic conversation structure exists, but no automated daily flow

---

## 🔧 **Refactoring & Improvement Suggestions**

### **Priority 1: Critical Architecture Issues**

#### 1.1 **Extract AI Core to Package**

**Current:** AI logic is embedded in `apps/api/src/ai/ai.service.ts`

**Recommended:**

```
packages/ai-core/
├── src/
│   ├── providers/
│   │   ├── llm.provider.interface.ts
│   │   ├── ollama.provider.ts
│   │   ├── openai.provider.ts
│   │   └── gemini.provider.ts
│   ├── prompts/
│   │   ├── system.prompt.ts
│   │   ├── manager.prompt.ts
│   │   ├── reflection.prompt.ts
│   │   ├── companion.prompt.ts
│   │   └── info.prompt.ts
│   ├── memory/
│   │   ├── retriever.interface.ts
│   │   ├── vector.retriever.ts
│   │   └── simple.retriever.ts (fallback)
│   └── index.ts
```

**Benefits:**

- Reusable across different services
- Easier to test
- Clear separation of concerns
- Supports multiple LLM providers

#### 1.2 **Implement Vector Memory (RAG)**

**Steps:**

1. Add pgvector extension to Prisma schema
2. Add `embedding` field to Memory model (vector type)
3. Create embeddings service (use OpenAI/Cohere/Ollama embeddings)
4. Implement vector similarity search
5. Update memory retrieval in ConversationsService

**Schema Update:**

```prisma
model Memory {
  // ... existing fields
  embedding Unsupported("vector(1536)")? // or appropriate dimension
}
```

**Migration needed:**

- Enable pgvector extension
- Add embedding column
- Create vector index for similarity search

#### 1.3 **Fix Configuration Management**

**Issues:**

- JWT secret hardcoded in `jwt.strategy.ts`
- Ollama URL/model hardcoded in `ai.service.ts`

**Fix:**

- Use `ConfigService` everywhere
- Create `config/configuration.ts` with validation
- Use `@nestjs/config` with schema validation

#### 1.4 **Create Shared Types Package**

**Structure:**

```
packages/shared-types/
├── src/
│   ├── dto/
│   │   ├── auth.dto.ts
│   │   ├── user.dto.ts
│   │   ├── conversation.dto.ts
│   │   └── message.dto.ts
│   ├── enums/
│   │   ├── conversation-mode.enum.ts
│   │   ├── conversation-state.enum.ts
│   │   └── message-role.enum.ts
│   └── index.ts
```

**Benefits:**

- Type safety between frontend and backend
- Single source of truth for types
- Easier refactoring

---

### **Priority 2: Code Quality & Best Practices**

#### 2.1 **Fix Type Safety Issues**

- Replace `Partial<any>` in `UsersService.update()` with proper DTO
- Remove `@ts-ignore` in `ConversationsService.handleMessage()`
- Add proper return types to all methods
- Use Prisma generated types instead of manual types

#### 2.2 **Add Missing DTOs**

- `UpdateUserDto` for user updates
- `UpdateProfileDto` for profile updates
- `SendMessageDto` for conversation messages
- `CreateConversationDto` for conversation creation

#### 2.3 **Improve Error Handling**

- Create custom exception filters
- Add proper error messages
- Implement error logging
- Add request ID tracking

#### 2.4 **Add Validation**

- Validate all input DTOs
- Add business logic validation
- Validate conversation mode transitions
- Validate memory importance range (1-10)

#### 2.5 **Module Dependencies**

- Add `PrismaModule` to `UsersModule` (currently missing)
- Ensure all modules properly export/import dependencies
- Review circular dependency risks

---

### **Priority 3: Feature Completeness**

#### 3.1 **Implement Tasks & Goals**

**Schema additions:**

```prisma
model Task {
  id          String   @id @default(uuid())
  userId      String
  conversationId String?
  title       String
  description String?
  status      TaskStatus @default(TODO)
  priority    Priority  @default(MEDIUM)
  dueDate     DateTime?
  goalId      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user         User     @relation(fields: [userId], references: [id])
  conversation Conversation? @relation(fields: [conversationId], references: [id])
  goal         Goal?    @relation(fields: [goalId], references: [id])

  @@index([userId, status])
}

model Goal {
  id          String   @id @default(uuid())
  userId      String
  title       String
  description String?
  type        GoalType @default(SHORT_TERM)
  status      GoalStatus @default(ACTIVE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user  User   @relation(fields: [userId], references: [id])
  tasks Task[]

  @@index([userId, status])
}
```

#### 3.2 **Implement Onboarding Flow**

- Create onboarding state in UserProfile
- Add onboarding questions endpoint
- Store onboarding responses as initial memories
- Mark onboarding as complete

#### 3.3 **Daily Flow Automation**

- Create scheduled jobs (cron) for morning briefing
- Create evening reflection prompts
- Add conversation state transitions based on time

---

### **Priority 4: Performance & Scalability**

#### 4.1 **Add Pagination**

- Conversations list pagination
- Messages pagination
- Memories pagination

#### 4.2 **Add Caching**

- Cache user profiles
- Cache active conversations
- Cache frequently accessed memories

#### 4.3 **Optimize Database Queries**

- Review N+1 query issues
- Add proper includes/selects
- Use Prisma query optimization

#### 4.4 **Add Health Checks**

- Database health check
- Ollama service health check
- Overall API health endpoint

---

### **Priority 5: Security Enhancements**

#### 5.1 **JWT Improvements**

- Implement refresh token rotation
- Add token blacklisting (Redis)
- Add token expiration handling
- Implement proper logout

#### 5.2 **Input Sanitization**

- Sanitize user inputs
- Validate file uploads (if any)
- Prevent SQL injection (Prisma handles this, but verify)

#### 5.3 **Rate Limiting**

- Add rate limiting middleware
- Protect auth endpoints
- Protect AI endpoints (cost control)

---

## 📋 **Recommended Implementation Order**

### **Phase 1: Foundation Fixes (Week 1)**

1. Fix configuration management (ConfigService)
2. Create shared types package
3. Fix type safety issues
4. Add missing DTOs
5. Fix module dependencies

### **Phase 2: AI Core Extraction (Week 2)**

1. Create AI Core package structure
2. Extract LLM provider abstraction
3. Extract prompt builders
4. Update AI service to use AI Core
5. Add support for multiple providers

### **Phase 3: RAG Implementation (Week 3)**

1. Set up pgvector extension
2. Add embedding field to Memory model
3. Create embeddings service
4. Implement vector similarity search
5. Update memory retrieval logic

### **Phase 4: Feature Completion (Week 4)**

1. Implement Tasks & Goals models
2. Add task/goal endpoints
3. Implement onboarding flow
4. Add daily flow automation

### **Phase 5: Polish & Optimization (Week 5)**

1. Add pagination
2. Add caching
3. Add health checks
4. Improve error handling
5. Add monitoring/logging

---

## 🎯 **Architecture Alignment Check**

### **Current vs. Specification**

| Component     | Spec Status | Implementation Status | Gap                |
| ------------- | ----------- | --------------------- | ------------------ |
| Auth (JWT)    | ✅ Required | ✅ Implemented        | Minor fixes needed |
| Users/Profile | ✅ Required | ✅ Implemented        | Missing validation |
| Conversations | ✅ Required | ✅ Implemented        | Missing RAG        |
| AI Service    | ✅ Required | ⚠️ Partial            | Needs abstraction  |
| Memory (RAG)  | ✅ Required | ❌ Missing            | Critical gap       |
| Tasks/Goals   | ✅ Required | ❌ Missing            | Feature gap        |
| Onboarding    | ✅ Required | ❌ Missing            | Feature gap        |
| Daily Flow    | ✅ Required | ⚠️ Partial            | Needs automation   |

---

## 💡 **Quick Wins**

1. **Fix JWT secret configuration** (15 min)
2. **Add PrismaModule to UsersModule** (5 min)
3. **Create UpdateUserDto** (10 min)
4. **Remove @ts-ignore** (30 min)
5. **Add health check endpoint** (20 min)
6. **Add request logging** (30 min)

---

## 📝 **Notes**

- The current implementation provides a solid foundation
- Core conversation flow is working
- Main gaps are in RAG implementation and AI Core abstraction
- Code quality is good but needs some cleanup
- Architecture is mostly aligned with specification
- Missing features (Tasks, Goals, Onboarding) are clearly scoped but not yet implemented

---

**Next Steps:** Prioritize RAG implementation and AI Core extraction as these are core to the product vision of personalized, context-aware AI assistance.
