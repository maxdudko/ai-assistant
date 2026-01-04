/**
 * Core types for AI Core package
 */

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

export interface ConversationContext {
  mode: ConversationMode;
  userProfile?: UserProfile;
  messages: Message[];
  memories: Memory[];
}

export interface MemoryCandidate {
  content: string;
  importance: number;
  tags?: string[];
}

export interface AiResponse {
  content: string;
  memoryCandidates?: MemoryCandidate[];
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
