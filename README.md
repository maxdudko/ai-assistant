# PMA — Personal Manager Assistant

**PMA** is a personal AI-powered assistant designed to help individuals manage their daily life, reduce cognitive load, and think more clearly in an information-saturated world.

This project is not about replacing humans with AI.
It is about **augmenting individual autonomy, clarity, and control**.

---

## 🧠 What is PMA?

PMA is a **stateful personal AI agent** that:

* understands user context
* remembers preferences and patterns
* helps plan days and manage tasks
* provides rational, calm support
* grows with the user over time

Unlike generic chatbots, PMA maintains a **long-term personal context**, making interactions increasingly relevant and personalized.

---

## 🎯 Core Principles

* **Individual-first** — one user, one personal AI context
* **Clarity over noise** — reduce information overload
* **No manipulation** — no ideology, no hidden incentives
* **Transparency** — explainable behavior and traceable context
* **User autonomy** — AI assists, user decides

---

## 🚀 MVP Scope (v0.1)

### Included

* User onboarding and personalization
* Chat-based interaction (core UI)
* Task and goal management
* Daily planning assistance
* Long-term memory (RAG)
* Neutral information digests (TruthLens Lite)

### Not included

* Autonomous actions without confirmation
* Voice or video
* Medical or psychological diagnosis
* Social features
* Plugins and third-party integrations

---

## 🧩 Key Features

### 🗨️ Conversational Interface

The primary interface is a chat where the user interacts with PMA in different modes:

* Manager (planning & tasks)
* Reflection (end-of-day summaries)
* Companion (supportive dialogue)
* Info (concise knowledge digests)

---

### 🧠 Long-Term Memory (RAG)

PMA stores relevant user context in vector memory:

* preferences
* habits
* recurring patterns
* reflections

Memory is used implicitly to personalize responses.

---

### 📅 Daily Flow

* Morning briefing
* Day planning assistance
* Evening reflection

---

## 🏗️ Architecture Overview

**Frontend**

* Next.js (App Router)
* TypeScript
* Tailwind CSS

**Backend**

* NestJS
* PostgreSQL
* Prisma ORM
* JWT Authentication

**AI Core**

* Prompt Builder
* LLM abstraction layer
* Vector memory (pgvector)

---

## 🛠️ Repository Structure (Planned)

```
personal-manager-assistant/
├── apps/
│   ├── web/        # Next.js frontend
│   └── api/        # NestJS backend
├── packages/
│   ├── shared-types
│   └── prompt-builder
├── docker-compose.yml
│── docs/
│   |── idea.md
│   ├── specification.md
│   └── roadmap.md
└── README.md
```

---

## 🌱 Long-Term Vision

PMA is envisioned as:

* a personal AI interface layer
* a personal digital twin
* a foundation for advanced personal intelligence systems

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
