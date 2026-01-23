# Current Functionality Overview

## Architecture Overview

The AI Assistant is a monorepo application with:
- **Backend API** (`apps/api`): NestJS-based REST API with Prisma ORM
- **Frontend Web** (`apps/web`): Next.js React application
- **AI Core Package** (`packages/ai-core`): Reusable AI service with LLM provider abstraction

---

## 1. Task Functionality

### Data Model
- **Task** model with fields:
  - Status: `TODO`, `IN_PROGRESS`, `DONE`
  - Priority: `LOW`, `MEDIUM`, `HIGH`
  - Source: `CHAT` (AI-generated) or `MANUAL`
  - Relationships: Can belong to a `Day`, `Conversation`, `Goal`, or have a `parent` task (hierarchical)
  - Optional deadline

### Key Features
- **Auto-linking to Days**: Tasks automatically link to today's day if no `dayId` is provided
- **Hierarchical Tasks**: Support for parent-child relationships (subtasks)
- **Goal Association**: Tasks can be linked to goals
- **Conversation Tracking**: Tasks can be created from conversations (source: `CHAT`)

### API Endpoints (`/tasks`)
- `POST /tasks` - Create task (auto-links to today's day)
- `GET /tasks` - Get all user tasks
- `GET /tasks/:id` - Get specific task
- `PATCH /tasks/:id` - Update task
- `DELETE /tasks/:id` - Delete task

### Service Logic (`TasksService`)
- Validates parent/goal/day relationships belong to user
- Prevents circular references in task hierarchy
- Automatically creates today's day if it doesn't exist when linking tasks

---

## 2. Day Functionality

### Data Model
- **Day** model represents a user's day:
  - State: `START`, `ACTIVE`, `END`
  - Unique per user per date (one day per user per calendar date)
  - Tracks `startedAt` and `endedAt` timestamps
  - Relationships: Contains `tasks` and `conversations`

### Key Features
- **Day Lifecycle**: Days progress through states (START → ACTIVE → END)
- **Auto-creation**: Days are automatically created when needed
- **Day Summary**: Provides aggregated view with task completion stats

### API Endpoints (`/day`)
- `GET /day/today` - Get or create today's day with tasks and conversations
- `POST /day/start` - Start the day (set to ACTIVE state)
- `POST /day/end` - End the day (set to END state)
- `GET /day/summary` - Get day summary with:
  - Day metadata
  - All conversations
  - Task summary (total, todo, in-progress, done, completion rate)
  - All tasks with goal associations

### Service Logic (`DaysService`)
- Normalizes dates to midnight (start of day)
- Returns day with related tasks and conversations
- Calculates task completion rates
- Creates day if it doesn't exist when requested

---

## 3. Conversation Functionality

### Data Model
- **Conversation** model:
  - Type: `DAILY` (one per day) or `AD_HOC` (on-demand)
  - Mode: `MANAGER`, `REFLECTION`, `COMPANION`, `INFO`
  - State: `CREATED`, `ACTIVE`, `ARCHIVED`
  - Links to a `Day` (for daily conversations)
  - Contains `messages` and `memories`
  - Can generate `tasks` and `goals`

### Key Features
- **Daily Conversations**: One conversation per user per day (auto-created)
- **Ad-hoc Conversations**: On-demand conversations in any mode
- **Mode Switching**: Conversations can switch between modes dynamically
- **Memory Extraction**: Automatically extracts memory candidates from conversations
- **Message History**: Full conversation history with message ordering

### API Endpoints (`/conversations`)
- `POST /conversations/message` - Send message (creates daily conversation if none exists)
- `GET /conversations/daily` - Get or create daily conversation
- `POST /conversations/ad-hoc` - Create new ad-hoc conversation
- `GET /conversations/:id` - Get specific conversation
- `GET /conversations` - Get all user conversations
- `PATCH /conversations/:id/mode` - Switch conversation mode
- `PATCH /conversations/:id/archive` - Archive conversation

### Service Logic (`ConversationsService`)
- **Auto-creation**: Daily conversations are created automatically on first message
- **Context Building**: Builds rich context for AI including:
  - Conversation mode
  - User profile (tone, verbosity, emoji preferences)
  - Message history
  - Relevant memories (top 10 by importance)
- **Memory Management**: 
  - Extracts memory candidates from AI responses
  - Only saves memories in REFLECTION/COMPANION modes (or high-importance in other modes)
- **State Management**: Conversations transition from CREATED → ACTIVE when first user message is sent

---

## 4. AI Integration (`packages/ai-core`)

### Architecture
The AI core package provides a clean abstraction over LLM providers with:
- **Provider Interface**: `LlmProvider` interface for pluggable LLM backends
- **AI Service**: Main orchestrator that handles prompt building, LLM calls, and memory extraction
- **Prompt System**: Mode-specific prompts with user context
- **Memory Extraction**: Heuristic-based memory candidate extraction

### Components

#### 1. AI Service (`ai.service.ts`)
- **Main Entry Point**: `generateResponse(message, context)`
- **Features**:
  - Builds system prompt with mode, user profile, and memories
  - Formats messages for LLM consumption
  - Calls LLM provider
  - Extracts memory candidates from response
  - Fallback stub responses if LLM fails (configurable)

#### 2. LLM Providers
- **OllamaProvider**: 
  - Default provider (uses Ollama API)
  - Configurable URL, model, temperature, topP, topK
  - Health check via `/api/tags` endpoint
  - Combines system prompt + messages into single prompt (Ollama limitation)
- **OpenAIProvider**: Available but not currently used
- **Provider Interface**: Standardized interface for adding new providers

#### 3. Prompt System

**System Prompt Builder** (`prompts/system.prompt.ts`):
- Combines mode-specific instructions
- Adds user profile information (name, tone, verbosity, emoji preferences)
- Includes relevant memories (top 10 by importance)
- Contextual instructions

**Mode Prompts** (`prompts/mode.prompts.ts`):
- **MANAGER**: Personal manager assistant
  - Helps plan and complete day
  - Works within current day context
  - Suggests actions (doesn't perform them directly)
  - Should return structured action candidates (currently not fully implemented)
- **REFLECTION**: Reflection companion
  - Summarizes day
  - Asks thoughtful questions
  - Captures insights and learnings
  - Identifies patterns
- **COMPANION**: Supportive companion
  - Empathetic support
  - Free dialogue
  - Active listening
  - Warm and understanding
- **INFO**: Information assistant
  - Factual summaries
  - Neutral and objective
  - Brief and clear

#### 4. Memory Extraction (`memory/extractor.ts`)
- **Heuristic-based extraction** (not AI-powered yet):
  - **REFLECTION mode**: Extracts memories for insights, learnings, patterns
  - **MANAGER mode**: Only extracts high-priority items (importance >= 8)
  - **COMPANION mode**: Currently skips most (can be enhanced)
- **Memory Candidates**: Returned with content, importance (1-10), and tags

### Integration with API (`apps/api/src/ai/ai.service.ts`)
- **Adapter Layer**: Maps Prisma types to ai-core types
- **Configuration**: 
  - Reads `OLLAMA_URL` and `OLLAMA_MODEL` from environment
  - Defaults: `http://localhost:11434` and `gemma3:1b`
- **Initialization**: Sets up Ollama provider on module init

### Current Limitations
1. **Action Extraction**: MANAGER mode prompt mentions structured action candidates, but this isn't fully implemented
2. **Memory Extraction**: Uses simple heuristics, not AI-powered extraction
3. **Day Context**: MANAGER mode prompt references `{{date}}`, `{{dayState}}`, `{{tasks}}` placeholders but they're not currently populated
4. **Stub Fallback**: Falls back to stub responses if LLM fails (good for development, but may need refinement)

---

## 5. Data Flow: Task/Day/Conversation Integration

### Typical Flow

1. **User sends message** → `POST /conversations/message`
2. **Conversation Service**:
   - Gets or creates daily conversation
   - Links to today's day (creates if needed)
   - Saves user message
3. **AI Service**:
   - Builds context (mode, profile, messages, memories)
   - Generates AI response via LLM
   - Extracts memory candidates
4. **Post-processing**:
   - Saves AI response as message
   - Creates memory records from candidates (if any)
5. **Response**: Returns assistant message

### Day-Centric Organization
- **Days** are the central organizing unit
- **Tasks** automatically link to today's day
- **Conversations** link to days (daily conversations are one per day)
- **Day Summary** provides unified view of day's activities

### Task Creation from Conversations
- Tasks can be created with `source: 'CHAT'` and `conversationId`
- This links tasks back to the conversation that generated them
- Currently, this requires manual task creation (AI doesn't auto-create tasks yet)

---

## 6. Goals Functionality

### Data Model
- **Goal** model:
  - Type: `SHORT`, `MIDDLE`, `LONG`
  - Priority: `LOW`, `MEDIUM`, `HIGH`
  - Source: `CHAT` or `MANUAL`
  - `isAchieved` boolean
  - Hierarchical (parent/subgoals)
  - Can have associated tasks

### API Endpoints (`/goals`)
- Standard CRUD operations (similar to tasks)
- Goals can be linked to conversations
- Tasks can be linked to goals

---

## 7. Frontend Integration

### Chat Component (`apps/web/src/components/chat.tsx`)
- Loads conversation on mount
- Sends messages via `sendMessageApi`
- Supports mode switching
- Displays markdown-formatted messages
- Optimistic UI updates

### API Client (`apps/web/src/lib/api/`)
- Type-safe API client with authentication
- Handles JWT tokens via cookies
- Provides functions for conversations, tasks, days, goals

---

## 8. Key Design Patterns

### 1. Auto-Creation Pattern
- Days, daily conversations, and day-linked tasks auto-create when needed
- Reduces boilerplate for users

### 2. Day-Centric Organization
- Everything revolves around days
- Provides natural organization and context

### 3. Mode-Based AI Behavior
- Different conversation modes change AI personality and behavior
- Allows same AI to serve different purposes

### 4. Memory System
- Memories extracted from conversations
- Used to provide context in future conversations
- Importance-based filtering

### 5. Provider Abstraction
- LLM providers are pluggable
- Easy to switch between Ollama, OpenAI, or add new providers

---

## 9. Current Gaps / Future Enhancements

1. **Action Extraction**: MANAGER mode should extract structured actions (task creation, goal setting)
2. **Day Context in Prompts**: Populate day state and tasks in MANAGER mode prompts
3. **AI-Powered Memory Extraction**: Replace heuristics with AI-based extraction
4. **Task Auto-Creation**: AI should be able to create tasks directly from conversations
5. **Goal Auto-Creation**: Similar to tasks
6. **Streaming Responses**: Currently uses non-streaming LLM calls
7. **Better Error Handling**: More graceful degradation when LLM is unavailable

---

## 10. Configuration

### Environment Variables
- `OLLAMA_URL`: Ollama API URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL`: Model name (default: `gemma3:1b`)

### Database
- PostgreSQL with Prisma ORM
- Migrations in `apps/api/prisma/migrations/`
