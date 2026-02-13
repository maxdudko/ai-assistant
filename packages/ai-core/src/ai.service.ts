/**
 * AI Service
 *
 * Main orchestrator for AI interactions
 * Handles prompt building, LLM calls, and memory extraction
 */

import { randomUUID } from 'crypto';

import type { ActionCandidate, ActionType } from '@ai/shared-types';

import type {
  ConversationContext,
  AiResponse,
  UserProfile,
  LlmRequest,
  MemoryCandidate,
} from './types/index.js';
import { ConversationMode } from './types/index.js';
import type { LlmProvider } from './providers/index.js';
import { buildSystemPrompt } from './prompts/index.js';
import { messagesToLlmFormat } from './prompts/message.formatter.js';
import { extractMemoryCandidates } from './memory/index.js';

export interface AiServiceConfig {
  provider: LlmProvider;
  enableStubFallback?: boolean;
}

/**
 * Generate stub response for fallback scenarios
 */
function generateStubResponse(
  message: string,
  mode: ConversationMode,
  profile?: UserProfile,
): string {
  const modeResponses: Record<ConversationMode, string> = {
    [ConversationMode.MANAGER]: `I understand you want to: "${message}". Let me help you break this down and plan it effectively. What's the most important aspect to focus on first?`,
    [ConversationMode.REFLECTION]: `Thank you for sharing: "${message}". This seems meaningful. What insights or patterns do you notice from this experience?`,
    [ConversationMode.COMPANION]: `I hear you: "${message}". How are you feeling about this?`,
    [ConversationMode.INFO]: `Regarding "${message}": Here's a concise summary... [INFO MODE - Stub response]`,
  };

  let response = modeResponses[mode] || modeResponses[ConversationMode.MANAGER];

  // Adjust based on profile
  if (profile?.verbosity === 'low') {
    response = response.split('.')[0] + '.';
  } else if (profile?.verbosity === 'high') {
    response += ' Would you like me to elaborate on any specific aspect?';
  }

  return response;
}

export class AiService {
  private readonly provider: LlmProvider;
  private readonly enableStubFallback: boolean;

  constructor(config: AiServiceConfig) {
    this.provider = config.provider;
    this.enableStubFallback = config.enableStubFallback ?? true;
  }

  /**
   * Generate AI response based on message and context
   */
  async generateResponse(message: string, context: ConversationContext): Promise<AiResponse> {
    try {
      // Build system prompt with all context
      const systemPrompt = buildSystemPrompt(context);

      // Format messages for LLM
      const llmMessages = messagesToLlmFormat(context.messages);

      // Add current user message
      llmMessages.push({
        role: 'USER',
        content: message,
      });

      // Build LLM request
      const llmRequest: LlmRequest = {
        systemPrompt,
        messages: llmMessages,
        temperature: 0.7,
      };

      // Call LLM provider
      const llmResponse = await this.provider.generate(llmRequest);
      const parsedResponse = parseStructuredResponse(llmResponse.content);

      // Extract memory candidates or use structured payload if provided
      const derivedCandidates = extractMemoryCandidates(
        message,
        parsedResponse.text,
        context.mode,
        context.memories,
      );
      const memoryCandidates =
        parsedResponse.memoryCandidates && parsedResponse.memoryCandidates.length > 0
          ? parsedResponse.memoryCandidates
          : derivedCandidates;

      return {
        content: parsedResponse.text,
        actionCandidates: parsedResponse.actions.length > 0 ? parsedResponse.actions : undefined,
        memoryCandidates: memoryCandidates.length > 0 ? memoryCandidates : undefined,
        summary: parsedResponse.summary,
      };
    } catch (error) {
      // Log error (caller should handle logging with their logger)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Fallback to stub response if enabled
      if (this.enableStubFallback) {
        const fallbackResponse = generateStubResponse(message, context.mode, context.userProfile);
        return {
          content: fallbackResponse,
        };
      }

      // Re-throw if fallback is disabled
      throw new Error(`Failed to generate AI response: ${errorMessage}`);
    }
  }

  /**
   * Generate JSON payload from a prompt.
   * Returns null when output is not valid JSON and fallback mode is enabled.
   */
  async generateJson<T>(request: LlmRequest): Promise<T | null> {
    try {
      const llmResponse = await this.provider.generate(request);
      return parseJsonPayload<T>(llmResponse.content);
    } catch (error) {
      if (this.enableStubFallback) {
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to generate JSON response: ${errorMessage}`);
    }
  }

  /**
   * Check if the AI service is available
   */
  async isAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }

  /**
   * Get the provider name
   */
  getProviderName(): string {
    return this.provider.getName();
  }
}

const ACTION_TYPES = new Set<ActionType>([
  'TASK_CREATE',
  'TASK_UPDATE_STATUS',
  'TASK_SET_PRIORITY',
  'TASK_SET_DUE_DATE',
  'TASK_COMPLETE',
  'DAY_START',
  'DAY_END',
  'SUGGEST_DIGEST_SUBSCRIPTION',
]);

function parseStructuredResponse(content: string): {
  text: string;
  actions: ActionCandidate[];
  summary?: string;
  memoryCandidates?: MemoryCandidate[];
} {
  const parsed = parseJsonPayload<{
    text?: unknown;
    actions?: unknown;
    summary?: unknown;
    memoryCandidates?: unknown;
  }>(content);

  if (!parsed) {
    return { text: content, actions: [] };
  }

  const text = typeof parsed.text === 'string' ? parsed.text : content;
  const actions = Array.isArray(parsed.actions)
    ? parsed.actions
        .map(candidate => normalizeActionCandidate(candidate))
        .filter((candidate): candidate is ActionCandidate => candidate !== null)
    : [];
  const summary = typeof parsed.summary === 'string' ? parsed.summary : undefined;
  const memoryCandidates = Array.isArray(parsed.memoryCandidates)
    ? parsed.memoryCandidates
        .map(candidate => normalizeMemoryCandidate(candidate))
        .filter((candidate): candidate is MemoryCandidate => candidate !== null)
    : undefined;

  return { text, actions, summary, memoryCandidates };
}

function stripJsonFence(content: string): string {
  if (!content.startsWith('```')) {
    return content;
  }

  return content
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
}

function looksLikeJson(content: string): boolean {
  return content.startsWith('{') && content.endsWith('}');
}

function parseJsonPayload<T>(content: string): T | null {
  const jsonPayload = stripJsonFence(content.trim());

  if (!looksLikeJson(jsonPayload)) {
    return null;
  }

  try {
    return JSON.parse(jsonPayload) as T;
  } catch {
    return null;
  }
}

function normalizeActionCandidate(candidate: unknown): ActionCandidate | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const typeRaw = typeof record.type === 'string' ? record.type.toUpperCase() : '';
  if (!ACTION_TYPES.has(typeRaw as ActionType)) {
    return null;
  }

  const confidenceRaw = typeof record.confidence === 'number' ? record.confidence : 0.5;
  const confidence = Math.min(1, Math.max(0, confidenceRaw));

  // Validate UUID format - if provided ID is not a valid UUID, generate a new one
  const providedId = typeof record.id === 'string' ? record.id : '';
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    providedId,
  );
  const id = isValidUUID ? providedId : randomUUID();

  return {
    id,
    type: typeRaw as ActionType,
    payload: isRecord(record.payload) ? record.payload : {},
    confidence,
    requiresConfirmation: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeMemoryCandidate(candidate: unknown): MemoryCandidate | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const content = typeof record.content === 'string' ? record.content.trim() : '';
  if (!content) {
    return null;
  }

  const typeRaw = typeof record.type === 'string' ? record.type.toUpperCase() : '';
  if (typeRaw !== 'FACTUAL' && typeRaw !== 'REFLECTION') {
    return null;
  }

  const importanceRaw = typeof record.importance === 'number' ? record.importance : 5;
  const importance = Math.min(10, Math.max(1, Math.round(importanceRaw)));

  const confidenceRaw = typeof record.confidence === 'number' ? record.confidence : 0.5;
  const confidence = Math.min(1, Math.max(0, confidenceRaw));

  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === 'string')
    : undefined;

  return {
    content,
    type: typeRaw as MemoryCandidate['type'],
    importance,
    tags,
    confidence,
  };
}
