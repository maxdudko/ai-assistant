/**
 * AI Core Package
 *
 * Main exports for the AI Core package
 */

// Types - export all types and enums explicitly for better TypeScript resolution
export * from './types/index.js';
export type {
  ConversationContext,
  AiResponse,
  Message,
  UserProfile,
  Memory,
  MemoryCandidate,
  LlmRequest,
  LlmResponse,
} from './types/index.js';
export { ConversationMode, MessageRole } from './types/index.js';

// Providers - export all providers and interfaces
export type { LlmProvider } from './providers/index.js';
export { OllamaProvider, OpenAIProvider } from './providers/index.js';
export type { OllamaConfig, OpenAIConfig } from './providers/index.js';

// Prompts - export prompt builders
export * from './prompts/index.js';

// Memory - export memory utilities
export * from './memory/index.js';

// Main service - export AI service and config
export { AiService } from './ai.service.js';
export type { AiServiceConfig } from './ai.service.js';
