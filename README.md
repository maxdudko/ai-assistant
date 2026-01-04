# PMA — Personal Manager Assistant

**PMA** is a personal AI-powered assistant designed to help individuals manage their daily life, reduce cognitive load, and think more clearly in an information-saturated world.

This project is not about replacing humans with AI.
It is about **augmenting individual autonomy, clarity, and control**.

---

## 🧠 What is PMA?

PMA is a **stateful personal AI agent** that:

- understands user context
- remembers preferences and patterns
- helps plan days and manage tasks
- provides rational, calm support
- grows with the user over time

Unlike generic chatbots, PMA maintains a **long-term personal context**, making interactions increasingly relevant and personalized.

---

## 🎯 Core Principles

- **Individual-first** — one user, one personal AI context
- **Clarity over noise** — reduce information overload
- **No manipulation** — no ideology, no hidden incentives
- **Transparency** — explainable behavior and traceable context
- **User autonomy** — AI assists, user decides

---

## 🚀 MVP Scope (v0.1)

### Included

- User onboarding and personalization
- Chat-based interaction (core UI)
- Task and goal management
- Daily planning assistance
- Long-term memory (RAG)
- Neutral information digests (TruthLens Lite)

### Not included

- Autonomous actions without confirmation
- Voice or video
- Medical or psychological diagnosis
- Social features
- Plugins and third-party integrations

---

## 🧩 Key Features

### 🗨️ Conversational Interface

The primary interface is a chat where the user interacts with PMA in different modes:

- Manager (planning & tasks)
- Reflection (end-of-day summaries)
- Companion (supportive dialogue)
- Info (concise knowledge digests)

---

### 🧠 Long-Term Memory (RAG)

PMA stores relevant user context in vector memory:

- preferences
- habits
- recurring patterns
- reflections

Memory is used implicitly to personalize responses.

---

### 📅 Daily Flow

- Morning briefing
- Day planning assistance
- Evening reflection

---

## 🏗️ Architecture Overview

**Frontend**

- Next.js (App Router)
- TypeScript
- Tailwind CSS

**Backend**

- NestJS
- PostgreSQL
- Prisma ORM
- JWT Authentication

**AI Core**

- Prompt Builder
- LLM abstraction layer
- Vector memory (pgvector)

---

## 🛠️ Repository Structure (Monorepo)

```
personal-manager-assistant/
├── apps/
│   ├── web/                    # Next.js
│   │   ├── src/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── api/                    # NestJS
│       ├── src/
│       ├── prisma/
│       │   └── schema.prisma
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared-types/
│   │   ├── src/
│   │   │   ├── dto/
│   │   │   ├── enums/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ai-core/
│   │   ├── prompts/
│   │   │   ├── system.ts
│   │   │   ├── planner.ts
│   │   │   └── memory.ts
│   │   │
│   │   ├── providers/
│   │   │   ├── openai.provider.ts
│   │   │   ├── gemini.provider.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── rag/
│   │   │   ├── retriever.ts
│   │   │   ├── embeddings.ts
│   │   │   └── vector-store.ts
│   │   │
│   │   ├── memory/
│   │   │   ├── short-term.ts
│   │   │   ├── long-term.ts
│   │   │   └── summary.ts
│   │   └── package.json
│   ├── utils/
│   │   ├── src/
│   │   └── package.json
│   │
│   └── config/
│       ├── eslint/
│       ├── tsconfig/
│       ├── env/
│       └── package.json
│
├── infra/
│   ├── docker/
│   │   ├── api.Dockerfile
│   │   ├── web.Dockerfile
│   │   └── db.Dockerfile
│   └── compose.yml
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```

---

## 🐳 Development Setup with Docker

1️⃣ **Clone the repository**

```shell
git clone git@github.com:maxdudko/ai-assistant.git
cd ai-assistant
```

2️⃣ **Build Docker images**

```shell
# API
docker build -f infra/docker/api.dev.Dockerfile -t ai-assistant-api .

# WEB
docker build -f infra/docker/web.dev.Dockerfile -t ai-assistant-web .
```

3️⃣ **Launch all services**

```shell
docker compose -f compose.dev.yaml up --build
```

- The API (NestJS) will be available at http://localhost:4000
- The WEB (Next.js) will be available at http://localhost:3000
- The DB (PostgreSQL) will be automatically started with data from Docker-compose

---

4️⃣ **Building and installing dependencies**

```shell
# For the API
docker compose -f compose.dev.yaml run --rm api sh
pnpm install

# For the WEB
docker compose -f compose.dev.yaml run --rm web sh
pnpm install
```

5️⃣ **Useful Docker Commands**

```shell
# Stop all services
docker compose -f compose.dev.yaml down -v

# Rebuild all services without cache
docker compose -f compose.dev.yaml build --no-cache

# Start only API or WEB
docker compose -f compose.dev.yaml up api
docker compose -f compose.dev.yaml up web
```

---

## 🌱 Long-Term Vision

PMA is envisioned as:

- a personal AI interface layer
- a personal digital twin
- a foundation for advanced personal intelligence systems

---

## 📘 Project Idea

See [idea.md](docs/idea.md) for the original project idea.

---

## 📐 Technical Specification

See [specification.md](docs/specification.md) for the full technical specification.

---

## 📅 Roadmap

See [roadmap.md](docs/roadmap.md) for detailed plans.

---

## 📜 License

To be defined.

---

**PMA is about empowering individuals — not automating them away.**
