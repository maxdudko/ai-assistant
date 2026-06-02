# MIRA — Product Roadmap

Version: **v0.1 → v1.0**

Focus: **MVP → Product-Market Fit → Personal AI Platform**

---

## 🎯 Roadmap Goals

This roadmap answers three key questions:

1. **What are we building initially?** (MVP, v0.1)
2. **How ​​do we validate product value?** (v0.2–v0.3)
3. **What can MIRA evolve into?** (v0.4+)

Principle:

> **Each version reinforces the feeling: "MIRA understands me and helps me think more clearly."**

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

## 📊 v0.3 — Insight & Reflection Layer ✅

**Status:** Delivered (Beta)

**Goal:**
To help users **better understand themselves**, not just complete tasks.

### Delivered Features

#### Reflection Engine

- Automatic weekly summaries (Sunday 22:00 UTC cron + per-user manual trigger).
- `WeeklyInsight` model persists per-ISO-week score, completion rate, top patterns,
  focus suggestion, and a personal narrative authored by the LLM with a
  deterministic fallback for offline LLM environments.
- Recurring patterns:
  - **Procrastination** (rolling stalled tasks + repeated reschedules).
  - **Overload** (replaces / extends the legacy `overcommitment` detector,
    keeping the original tag for backward compatibility with stored memories).
  - **Productivity peaks** — distinct detectors for morning / afternoon /
    evening / late-night peaks based on completion-time clustering.
- Surfaced via the new `/me/insights` page and the AI's RAG context as
  `EPISODIC` reflection memories.

#### Goals Deepening

- Tasks can be linked to goals from chat via the new `TASK_LINK_GOAL` action
  (reversible via undo).
- Manager mode prompt now includes the user's active goals and asks
  _"Does this bring you closer to X?"_ when alignment is unclear.
- New `GET /goals/:id/progress` endpoint and goal-progress bars in the goals UI.

#### TruthLens Lite → v2

- New `buildTruthLensDigestPrompt` produces structured perspectives (claim,
  evidence, limitations), a consensus statement, open questions and an
  explicit confidence label.
- Comparative queries (`vs`, `compare`, `should I`, `pros and cons`, …) are
  routed through the new path; an LLM classifier handles ambiguous wording.
- Falls back to the existing neutral digest when TruthLens output is
  unusable, keeping INFO mode resilient.
- Stricter rationality and "minimize emotions" rules are encoded in the
  prompt itself; UI renders the structured response as markdown with a
  visible confidence label.

### Success Criteria — verification

- _≥1 useful insight per week_: enforced by the weekly cron + manual trigger;
  empty weeks gracefully short-circuit instead of producing low-signal noise.
- _Weekly report evokes "this is about me"_: narrative is built from the
  user's actual completion data, recurring patterns and recent reflections.
- _TruthLens provides rational feedback_: comparative queries return
  evidence + limitations + uncertainty rather than a single opinion.

---

## 🧠 v0.4 — Personal AI Agent

**Goal:**
Create a sustainable personal AI agent.

### Capabilities

- Long-term user model
- Predictability of MIRA behavior
- Context across days and weeks

⚠️ Still:

- No autonomous actions
- No decision-making for the user

---

## 🌱 v1.0 — Personal AI Platform

**Vision:**
MIRA as a personal interface between humans and the digital world.

### Possible Directions

- Plugins (opt-in)
- Multi-agent thinking (planner / analyst / reflector)
- Advanced memory visualization
- Personal context export

---
