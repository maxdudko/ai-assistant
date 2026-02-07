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

export interface ConversationContext {
  mode: ConversationMode;
  userProfile?: UserProfile;
  messages: Message[];
  memories: Memory[];
  day?: DayContext;
  tasksToday?: TaskContext[];
  backlogTasks?: TaskContext[];
  keyMessages?: string[];
}

export type MemoryType = 'FACTUAL' | 'REFLECTION';
export type MemorySource = 'CONVERSATION' | 'REFLECTION' | 'ONBOARDING';

export interface MemoryCandidate {
  content: string;
  type: MemoryType;
  importance: number; // 1..10
  tags?: string[];
  confidence: number; // 0..1
}

export interface AiResponse {
  content: string;
  actionCandidates?: ActionCandidate[];
  memoryCandidates?: MemoryCandidate[];
  summary?: string;
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
