# Personal Manager Assistant (MIRA)

**Version:** v0.1 (MVP)

**Product Type:** AI-powered personal assistant (SaaS)

**Target Audience:** Individual users (general-purpose)

---

## 1. Project Idea

### 1.1. Problem

Modern people are overloaded with:

- information
- tasks
- notifications
- the need to constantly make decisions

Existing tools (task managers, calendars, notes, chatbots):

- fragmented
- do not take into account the user's context
- do not "think" with the user
- do not reduce cognitive load, but often increase it

---

### 1.2. Solution

**MIRA** is a personal AI assistant that:

- understands the user's context
- helps manage daily life
- remembers preferences and patterns
- interacts through dialogue
- reduces cognitive and emotional load

MIRA does not replace the user,
but **works alongside them** as:

- personal manager
- assistant
- rational conversationalist

---

### 1.3. Key Idea

> **"One person - one personal AI context"**

MIRA is not just a chat with LLM, but a **long-lived personal agent** that becomes increasingly personalized over time.

---

## 2. Core Functionality (MVP v0.1)

### 2.1. Onboarding and Personalization

**Goal:** quickly create a personalized user context.

Functionality:

- Initial dialogue (5-7 questions)
- Collection:
  - Name
  - Communication style
  - Expectations from the assistant

- Configuration:
  - Tone of communication
  - Response brevity
  - Use of emoji

Result:

- User Profile generation
- Initial memory filling (Memory)

---

### 2.2. Dialogue Interface (Core)

**The central interaction method is chat.**

Dialogue modes:

- **Manager mode** — planning, tasks, priorities
- **Reflection mode** — brief reflections, daily summary
- **Companion mode** — free dialogue, support
- **Info mode (Lite)** — brief information summaries

Features:

- One active context per user
- Dialogue history is saved
- Responses are personalized

---

### 2.3. Task and Goal Management

#### Tasks:

- Create via chat
- Change status
- Priorities
- Deadlines
- Link to goals

#### Goals:

- Short-term / Medium-term / Long-term
- Link to tasks
- Use as context for recommendations

---

### 2.4. Daily Flow (minimal)

- **Morning briefing**
  - Tasks for the day
  - 1-2 priorities

- **Help with daily planning**
- **Evening reflection**
  - What has been accomplished
  - Short question for reflection

---

### 2.5. Memory (RAG)

MIRA has a long-term memory.

Memory types:

- preferences
- user facts
- habits
- emotional reactions
- past inferences

Features:

- stored in a vector DB
- retrieval based on relevance
- used implicitly in responses
- the user does not need to "manage" the memory manually

---

### 2.6. Info Digest (TruthLens Lite)

MVP version:

- the user selects topics
- MIRA produces brief, neutral summaries
- without emotional coloring or manipulation

---

## 3. Basic Project Architecture

### 3.1. General Architecture

**Type:** Fullstack SaaS + AI Core

**Approach:** Stateful AI Agent + Stateless API

```
Frontend (Next.js)
↓
Backend API (NestJS)
↓
AI Core (Prompt Builder + LLM)
↓
DB + Vector Storage
```

---

### 3.2. Frontend

**Technologies:**

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- React Query
- Zustand

**Main Screens:**

- Auth (login/register)
- Onboarding
- Dashboard
- Chat (main screen)

---

### 3.3. Backend

**Technologies:**

- NestJS
- PostgreSQL
- Prisma ORM
- JWT (auth)
- pgvector (embeddings)

**Core Modules:**

- Auth
- Users / Profile
- Tasks
- Goals
- Conversations
- Memory
- AI Service

---

### 3.4. AI Core

**Components:**

- Prompt Builder (dynamic)
- LLM Provider Abstraction
- Memory Retrieval (RAG)

**Response context is formed from:**

- system prompt
- mode
- user profile
- relevant memory
- current message

---

### 3.5. Architecture Principles

- LLM contains no business logic
- all personalization is context-based
- extensibility for:
  - new models
  - new modes
  - multi-agent approach

- no rigid lock-in to a single AI provider

---

## 4. Long-Term Vision

MIRA is seen as:

- the foundation for personal AI
- a personal digital twin
- an interface between humans and future AI systems

---
