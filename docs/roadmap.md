# PMA — Product Roadmap

Version: **v0.1 → v1.0**

Focus: **MVP → Product-Market Fit → Personal AI Platform**

---

## 🎯 Roadmap Goals

This roadmap answers three key questions:

1. **What are we building initially?** (MVP, v0.1)
2. **How ​​do we validate product value?** (v0.2–v0.3)
3. **What can PMA evolve into?** (v0.4+)

Principle:

> **Each version reinforces the feeling: "PMA understands me and helps me think more clearly."**

---

## 🧪 v0.1 — MVP: Personal Daily Manager

**Goal:**
To create a minimum viable personal AI assistant that:

- understands one user
- helps you get through the day more consciously
- creates a long-lasting personal context

**Focus:** Daily Flow + Tasks + Memory

### 🔹 Core Functionality

#### Onboarding & Profile

- Dialog onboarding (5-7 questions)
- User Profile creation
- Settings:
  - Communication style
  - Response brevity
  - Tone

#### Chat (Core UI)

- One main screen — chat
- Dialog history
- Modes:
  - Manager
  - Reflection
  - Companion
  - Info (Lite)

#### Tasks & Goals

- Task creation via chat
- Statuses (todo / done)
- Priority (low / medium / high)
- Deadlines
- Basic goals (without complex hierarchy)

#### Daily Flow (MVP)

- Morning briefing:
  - Daily tasks
  - 1-2 Priority

- Help with daily planning (upon request)
- Evening reflection:
  - What has been done
  - 1 question to ponder

#### Memory (RAG v0)

- Storage:
  - Preferences
  - User facts
  - Reflection conclusions

- Vector storage (pgvector)
- Retrieval: Top 3 relevant memories

#### Info Digest (Lite)

- Select 1–2 topics
- Brief, neutral summary
- No feed or endless news

---

### 🔹 Technical scope v0.1

**Frontend**

- Next.js (App Router)
- Chat UI
- Onboarding flow

**Backend**

- Auth (JWT)
- Users / Profile
- Tasks / Goals
- Conversations
- Memory

**AI Core**

- Prompt Builder (system + modes)
- One LLM provider
- Simple RAG logic

---

## 🔍 v0.2 — Personal Context Expansion

**Goal:**
Deepen personalization and the feeling of "he knows me."

### New Features

#### Enhanced Memory

- Memory Separation:
  - Factual
  - Behavioral Patterns
  - Reflections

- Improved Retrieval (Context-Aware)

#### Smarter Daily Flow

- Adapt the morning briefing to previous days
- Tracking:
  - Completed/Uncompleted Tasks
  - User Rhythm

#### Task Intelligence (Lite)

- Suggestions:
  - Simplify the Day
  - Reduce Tasks

- Only Upon User Request

#### UX

- Gentle Reminders
- Minimal Notifications (Opt-in)

---

## 📊 v0.3 — Insight & Reflection Layer

**Goal:**
To help users **better understand themselves**, not just complete tasks.

### New Features

#### Reflection Engine

- Automatic weekly summaries
- Recurring patterns:
  - Procrastination
  - Overload
  - Productivity peaks

#### Goals Deepening

- Connect daily tasks to goals
- Questions:
  - "Does this bring you closer to X?"

#### TruthLens Lite → v2

- Comparison of perspectives
- Stricter rationality
- Minimizing emotions

---

## 🧠 v0.4 — Personal AI Agent

**Goal:**
Create a sustainable personal AI agent.

### Capabilities

- Long-term user model
- Predictability of PMA behavior
- Context across days and weeks

⚠️ Still:

- No autonomous actions
- No decision-making for the user

---

## 🌱 v1.0 — Personal AI Platform

**Vision:**
PMA as a personal interface between humans and the digital world.

### Possible Directions

- Plugins (opt-in)
- Multi-agent thinking (planner / analyst / reflector)
- Advanced memory visualization
- Personal context export

---
