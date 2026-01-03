/**
 * AI Service
 *
 * Main orchestrator for AI interactions
 * Handles prompt building, LLM calls, and memory extraction
 */

import {
  ConversationContext,
  AiResponse,
  Message,
  ConversationMode,
  UserProfile,
  LlmRequest,
} from './types/index.js';
import { LlmProvider } from './providers/index.js';
import { buildSystemPrompt } from './prompts/index.js';
import { messagesToLlmFormat } from './prompts/message.formatter.js';
import { extractMemoryCandidates } from './memory/index.js';
import { getModePrompt } from './prompts/mode.prompts.js';

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

      // Extract memory candidates
      const memoryCandidates = extractMemoryCandidates(
        message,
        llmResponse.content,
        context.mode,
        context.memories,
      );

      return {
        content: llmResponse.content,
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
