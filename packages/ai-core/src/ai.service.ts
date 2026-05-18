/**
 * AI Service
 *
 * Main orchestrator for AI interactions
 * Handles prompt building, LLM calls, and memory extraction
 */
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
import { buildMemoryExtractionPrompt, buildSystemPrompt } from './prompts/index.js';
import { messagesToLlmFormat } from './prompts/message.formatter.js';
import { extractMemoryCandidates } from './memory/index.js';

export interface AiServiceConfig {
  provider: LlmProvider;
  enableStubFallback?: boolean;
  enableMemoryExtraction?: boolean;
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
  private readonly memoryExtractionEnabled: boolean;

  constructor(config: AiServiceConfig) {
    this.provider = config.provider;
    this.enableStubFallback = config.enableStubFallback ?? true;
    this.memoryExtractionEnabled = config.enableMemoryExtraction ?? true;
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
      return this.buildAiResponseFromContent(message, context, llmResponse.content);
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
   * Generate AI response and stream intermediate tokens to callback.
   */
  async generateResponseStream(
    message: string,
    context: ConversationContext,
    onToken: (token: string) => Promise<void> | void,
  ): Promise<AiResponse> {
    try {
      const systemPrompt = buildSystemPrompt(context);
      const llmMessages = messagesToLlmFormat(context.messages);
      llmMessages.push({
        role: 'USER',
        content: message,
      });

      const llmRequest: LlmRequest = {
        systemPrompt,
        messages: llmMessages,
        temperature: 0.7,
      };

      if (!this.provider.generateStream) {
        const llmResponse = await this.provider.generate(llmRequest);
        const aiResponse = await this.buildAiResponseFromContent(
          message,
          context,
          llmResponse.content,
        );
        for (const char of aiResponse.content) {
          await onToken(char);
        }
        return aiResponse;
      }

      let content = '';
      for await (const token of this.provider.generateStream(llmRequest)) {
        content += token;
      }
      const aiResponse = await this.buildAiResponseFromContent(message, context, content);
      for (const char of aiResponse.content) {
        await onToken(char);
      }
      return aiResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (this.enableStubFallback) {
        const fallbackResponse = generateStubResponse(message, context.mode, context.userProfile);
        for (const char of fallbackResponse) {
          await onToken(char);
        }
        return {
          content: fallbackResponse,
        };
      }
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

  private buildAiResponseFromContent(
    message: string,
    context: ConversationContext,
    rawContent: string,
  ): Promise<AiResponse> {
    const parsedResponse = parseStructuredResponse(rawContent);
    const derivedCandidates = extractMemoryCandidates(
      message,
      parsedResponse.text,
      context.mode,
      context.memories,
    );
    const structuredCandidates = parsedResponse.memoryCandidates ?? [];

    return this.extractMemoryPayloadWithRetry(message, parsedResponse.text, context)
      .then(extractedPayload => {
        const memoryCandidates =
          extractedPayload?.memoryCandidates.length && this.memoryExtractionEnabled
            ? extractedPayload.memoryCandidates
            : structuredCandidates.length > 0
              ? structuredCandidates
              : derivedCandidates;

        return {
          content: parsedResponse.text,
          actionCandidates: parsedResponse.actions.length > 0 ? parsedResponse.actions : undefined,
          memoryCandidates: memoryCandidates.length > 0 ? memoryCandidates : undefined,
          summary: parsedResponse.summary ?? extractedPayload?.summary,
        };
      })
      .catch(() => ({
        content: parsedResponse.text,
        actionCandidates: parsedResponse.actions.length > 0 ? parsedResponse.actions : undefined,
        memoryCandidates:
          structuredCandidates.length > 0 ? structuredCandidates : derivedCandidates,
        summary: parsedResponse.summary,
      }));
  }

  private async extractMemoryPayloadWithRetry(
    userMessage: string,
    assistantText: string,
    context: ConversationContext,
  ): Promise<MemoryExtractionPayload | null> {
    if (!this.memoryExtractionEnabled || context.mode !== ConversationMode.REFLECTION) {
      return null;
    }

    const extractionRequest = this.buildMemoryExtractionRequest(
      userMessage,
      assistantText,
      context,
    );
    const firstTry = await this.provider.generate(extractionRequest);
    const firstValidation = parseAndValidateMemoryExtractionPayload(firstTry.content);
    if (firstValidation.payload) {
      return firstValidation.payload;
    }

    const retryRequest = this.buildMemoryExtractionRequest(
      userMessage,
      assistantText,
      context,
      firstValidation.errors,
    );
    const secondTry = await this.provider.generate(retryRequest);
    return parseAndValidateMemoryExtractionPayload(secondTry.content).payload;
  }

  private buildMemoryExtractionRequest(
    userMessage: string,
    assistantText: string,
    context: ConversationContext,
    validationErrors?: string[],
  ): LlmRequest {
    const payload = {
      userProfile: context.userProfile ?? null,
      day: context.day ?? null,
      tasksToday: context.tasksToday ?? [],
      keyMessages: context.keyMessages ?? [],
      latestUserMessage: userMessage,
      assistantText,
    };

    const instruction =
      validationErrors && validationErrors.length > 0
        ? `${JSON.stringify(payload)}\n\nYour previous output was invalid for these reasons:\n${validationErrors
            .map(error => `- ${error}`)
            .join('\n')}`
        : JSON.stringify(payload);

    return {
      systemPrompt: buildMemoryExtractionPrompt(),
      messages: [{ role: 'USER', content: instruction }],
      temperature: 0.1,
      maxTokens: 700,
    };
  }
}

interface MemoryExtractionPayload {
  summary: string;
  memoryCandidates: MemoryCandidate[];
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
  'SIMPLIFY_DAY',
  'SPLIT_TASK',
  'RESCHEDULE_TASK',
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

  const directParsed = tryParseJson<T>(jsonPayload);
  if (directParsed) {
    return directParsed;
  }

  const extractedJson = extractFirstJsonObject(jsonPayload);
  if (extractedJson) {
    return tryParseJson<T>(extractedJson);
  }

  return null;
}

function tryParseJson<T>(content: string): T | null {
  if (!looksLikeJson(content)) {
    return null;
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function extractFirstJsonObject(content: string): string | null {
  const start = content.indexOf('{');
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < content.length; i += 1) {
    const ch = content[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === '\\') {
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return content.slice(start, i + 1).trim();
      }
    }
  }

  return null;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
  const id = isValidUUID ? providedId : generateUUID();

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
  const layerRaw = typeof record.layer === 'string' ? record.layer.toUpperCase() : '';
  const layer =
    layerRaw === 'EPISODIC' || layerRaw === 'SEMANTIC' || layerRaw === 'PATTERN'
      ? layerRaw
      : typeRaw === 'REFLECTION'
        ? 'EPISODIC'
        : 'SEMANTIC';

  return {
    content,
    type: typeRaw as MemoryCandidate['type'],
    importance,
    tags,
    confidence,
    layer,
  };
}

function parseAndValidateMemoryExtractionPayload(content: string): {
  payload: MemoryExtractionPayload | null;
  errors: string[];
} {
  const parsed = parseJsonPayload<{
    summary?: unknown;
    memoryCandidates?: unknown;
  }>(content);
  if (!parsed) {
    return {
      payload: null,
      errors: ['Response is not valid JSON object.'],
    };
  }

  const errors: string[] = [];
  const summary =
    typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 280) : undefined;
  if (!summary) {
    errors.push('summary must be a non-empty string.');
  }

  if (!Array.isArray(parsed.memoryCandidates)) {
    errors.push('memoryCandidates must be an array.');
    return {
      payload: null,
      errors,
    };
  }

  if (parsed.memoryCandidates.length > 3) {
    errors.push('memoryCandidates must include at most 3 items.');
  }

  const memoryCandidates = parsed.memoryCandidates
    .map(candidate => normalizeMemoryExtractorCandidate(candidate))
    .filter((candidate): candidate is MemoryCandidate => candidate !== null);

  if (memoryCandidates.length !== parsed.memoryCandidates.length) {
    errors.push('Each memory candidate must match the required schema.');
  }

  if (errors.length > 0 || !summary) {
    return {
      payload: null,
      errors,
    };
  }

  return {
    payload: {
      summary,
      memoryCandidates,
    },
    errors: [],
  };
}

function normalizeMemoryExtractorCandidate(candidate: unknown): MemoryCandidate | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const content = typeof record.content === 'string' ? record.content.trim() : '';
  if (content.length < 8 || content.length > 500) {
    return null;
  }

  if (record.type !== 'REFLECTION') {
    return null;
  }

  if (record.layer !== 'EPISODIC') {
    return null;
  }

  if (!Array.isArray(record.tags) || record.tags.length < 1 || record.tags.length > 8) {
    return null;
  }
  const tags = record.tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map(tag => tag.toLowerCase().trim())
    .filter(tag => /^[a-z0-9-]{2,24}$/.test(tag));
  if (tags.length < 1 || tags.length > 8) {
    return null;
  }

  const importanceRaw = typeof record.importance === 'number' ? record.importance : NaN;
  if (!Number.isInteger(importanceRaw) || importanceRaw < 1 || importanceRaw > 10) {
    return null;
  }
  const confidenceRaw = typeof record.confidence === 'number' ? record.confidence : NaN;
  if (!Number.isFinite(confidenceRaw) || confidenceRaw < 0 || confidenceRaw > 1) {
    return null;
  }

  return {
    content,
    type: 'REFLECTION',
    layer: 'EPISODIC',
    importance: importanceRaw,
    tags: Array.from(new Set(tags)),
    confidence: confidenceRaw,
  };
}
