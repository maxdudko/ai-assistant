/**
 * Core types for AI Core package
 */

import type { ActionCandidate } from '@ai/shared-types';

export enum ConversationMode {
  MANAGER = 'MANAGER',
  REFLECTION = 'REFLECTION',
  COMPANION = 'COMPANION',
  INFO = 'INFO',
}

export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM',
}

export interface Message {
  role: MessageRole;
  content: string;
}

export interface UserProfile {
  displayName?: string;
  tone?: string;
  verbosity?: string;
  useEmoji?: boolean;
}

export interface Memory {
  content: string;
  importance: number;
  tags: string[];
  layer?: MemoryLayer;
  contextBucket?: MemoryContextBucket;
}

export type DayState = 'START' | 'ACTIVE' | 'END';

export interface DayContext {
  date: string;
  state: DayState;
}

export interface TaskContext {
  id: string;
  name: string;
  status: string;
  priority?: string;
  deadline?: string | null;
}

export interface GoalContext {
  id: string;
  name: string;
  type?: string;
  priority?: string;
  progressPct?: number;
}

export interface ConversationContext {
  mode: ConversationMode;
  userProfile?: UserProfile;
  messages: Message[];
  memories: Memory[];
  day?: DayContext;
  tasksToday?: TaskContext[];
  backlogTasks?: TaskContext[];
  keyMessages?: string[];
  activeGoals?: GoalContext[];
}

export type MemoryType = 'FACTUAL' | 'REFLECTION';
export type MemorySource = 'CONVERSATION' | 'REFLECTION' | 'ONBOARDING';
export type MemoryLayer = 'EPISODIC' | 'SEMANTIC' | 'PATTERN';
export type MemoryContextBucket = 'PATTERN' | 'SEMANTIC' | 'RECENT' | 'IMPORTANT';

export interface MemoryCandidate {
  content: string;
  type: MemoryType;
  importance: number; // 1..10
  tags?: string[];
  confidence: number; // 0..1
  layer: MemoryLayer;
}

export interface AiResponse {
  content: string;
  actionCandidates?: ActionCandidate[];
  memoryCandidates?: MemoryCandidate[];
  summary?: string;
}

export interface InfoSearchQueryPayload {
  searchQuery: string;
  topic?: string;
}

export interface InfoDigestPayload {
  title: string;
  highlights: string[];
}

export interface LlmRequest {
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}
