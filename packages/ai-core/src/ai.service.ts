/**
 * AI Service
 *
 * Main orchestrator for AI interactions
 * Handles prompt building, LLM calls, and memory extraction
 */

import type { ActionCandidate, ActionType } from '@ai/shared-types';
import { randomUUID } from 'crypto';

import type { ConversationContext, AiResponse, UserProfile, LlmRequest } from './types/index.js';
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

      // Extract memory candidates
      const memoryCandidates = extractMemoryCandidates(
        message,
        parsedResponse.text,
        context.mode,
        context.memories,
      );

      return {
        content: parsedResponse.text,
        actionCandidates: parsedResponse.actions.length > 0 ? parsedResponse.actions : undefined,
        memoryCandidates: memoryCandidates.length > 0 ? memoryCandidates : undefined,
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
]);

function parseStructuredResponse(content: string): { text: string; actions: ActionCandidate[] } {
  const trimmed = content.trim();
  const jsonPayload = stripJsonFence(trimmed);

  if (!looksLikeJson(jsonPayload)) {
    return { text: content, actions: [] };
  }

  try {
    const parsed = JSON.parse(jsonPayload) as {
      text?: unknown;
      actions?: unknown;
    };
    const text = typeof parsed.text === 'string' ? parsed.text : content;
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions
          .map(candidate => normalizeActionCandidate(candidate))
          .filter((candidate): candidate is ActionCandidate => candidate !== null)
      : [];

    return { text, actions };
  } catch {
    return { text: content, actions: [] };
  }
}

function stripJsonFence(content: string): string {
  if (!content.startsWith('```')) {
    return content;
  }

  return content.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
}

function looksLikeJson(content: string): boolean {
  return content.startsWith('{') && content.endsWith('}');
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
