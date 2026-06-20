import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationMode, MessageRole } from '@prisma/client';
import {
  AiService as CoreAiService,
  OllamaProvider,
  OpenAIProvider,
  type ConversationContext,
  type AiResponse,
  type Message as CoreMessage,
  type UserProfile as CoreUserProfile,
  type Memory as CoreMemory,
  type DayContext as CoreDayContext,
  type TaskContext as CoreTaskContext,
  type InfoSearchQueryPayload,
  type InfoDigestPayload,
  type LlmRequest,
  type WeeklyNarrativePayload,
  type TruthLensPayload,
  ConversationMode as CoreConversationMode,
  MessageRole as CoreMessageRole,
  buildInfoSearchQueryPrompt,
  buildInfoDigestSummarizationPrompt,
  buildWeeklySummaryPrompt,
  buildTruthLensClassifierPrompt,
  buildTruthLensDigestPrompt,
} from '@ai/ai-core';

import type { SearchResult } from '../search/search.types';

interface Message {
  role: MessageRole;
  content: string;
}

interface UserProfile {
  displayName?: string;
  tone?: string;
  verbosity?: string;
  useEmoji?: boolean;
}

interface Memory {
  content: string;
  importance: number;
  tags: string[];
  layer?: 'EPISODIC' | 'SEMANTIC' | 'PATTERN';
  contextBucket?: 'PATTERN' | 'SEMANTIC' | 'RECENT' | 'IMPORTANT';
}

interface DayContext {
  date: string;
  state: 'START' | 'ACTIVE' | 'END';
}

interface TaskContext {
  id: string;
  name: string;
  status: string;
  priority?: string;
  deadline?: string | null;
}

interface GoalContextLite {
  id: string;
  name: string;
  type?: string;
  priority?: string;
  progressPct?: number;
}

interface Context {
  mode: ConversationMode;
  userProfile?: UserProfile | null;
  messages: Message[];
  memories: Memory[];
  day?: DayContext;
  tasksToday?: TaskContext[];
  backlogTasks?: TaskContext[];
  keyMessages?: string[];
  activeGoals?: GoalContextLite[];
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private coreAiService: CoreAiService;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const provider = this.createLlmProvider();

    // Initialize core AI service
    this.coreAiService = new CoreAiService({
      provider,
      enableStubFallback: true,
    });

    this.logger.log(`AI provider initialized: ${provider.getName()}`);
  }

  private createLlmProvider() {
    const selectedProvider = this.configService.get<string>('LLM_PROVIDER', 'ollama').toLowerCase();

    if (selectedProvider === 'openai') {
      const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai');
      }

      return new OpenAIProvider({
        apiKey: openaiApiKey,
        model: this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini'),
        baseURL: this.configService.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        temperature: 0.7,
        maxTokens: Number(this.configService.get<string>('OPENAI_MAX_TOKENS', '2000')),
      });
    }

    if (selectedProvider !== 'ollama') {
      this.logger.warn(
        `Unknown LLM_PROVIDER value "${selectedProvider}". Falling back to "ollama".`,
      );
    }

    return new OllamaProvider({
      url: this.configService.get<string>('OLLAMA_URL', 'http://localhost:11434'),
      model: this.configService.get<string>('OLLAMA_MODEL', 'gemma3:1b'),
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
    });
  }

  /**
   * Generate AI response based on message and context
   * This method adapts between Prisma types and ai-core types
   */
  async generateResponse(message: string, context: Context): Promise<AiResponse> {
    try {
      // Convert Prisma types to ai-core types
      const coreContext: ConversationContext = {
        mode: this.mapConversationMode(context.mode),
        userProfile: context.userProfile ? this.mapUserProfile(context.userProfile) : undefined,
        messages: context.messages.map(msg => this.mapMessage(msg)),
        memories: context.memories.map(mem => this.mapMemory(mem)),
        day: context.day ? this.mapDayContext(context.day) : undefined,
        tasksToday: context.tasksToday?.map(task => this.mapTaskContext(task)),
        backlogTasks: context.backlogTasks?.map(task => this.mapTaskContext(task)),
        keyMessages: context.keyMessages,
        activeGoals: context.activeGoals,
      };

      // Call core AI service (it handles fallback internally)
      return await this.coreAiService.generateResponse(message, coreContext);
    } catch (error) {
      // Log error for API-specific logging
      // The core service should have already handled fallback, but if it throws,
      // we log it here for debugging
      this.logger.error('Failed to generate AI response:', error);
      // Re-throw only if fallback was disabled or if there's a different error
      throw error;
    }
  }

  async generateResponseStream(
    message: string,
    context: Context,
    onToken: (token: string) => Promise<void> | void,
  ): Promise<AiResponse> {
    try {
      const coreContext: ConversationContext = {
        mode: this.mapConversationMode(context.mode),
        userProfile: context.userProfile ? this.mapUserProfile(context.userProfile) : undefined,
        messages: context.messages.map(msg => this.mapMessage(msg)),
        memories: context.memories.map(mem => this.mapMemory(mem)),
        day: context.day ? this.mapDayContext(context.day) : undefined,
        tasksToday: context.tasksToday?.map(task => this.mapTaskContext(task)),
        backlogTasks: context.backlogTasks?.map(task => this.mapTaskContext(task)),
        keyMessages: context.keyMessages,
        activeGoals: context.activeGoals,
      };

      return await this.coreAiService.generateResponseStream(message, coreContext, onToken);
    } catch (error) {
      this.logger.error('Failed to stream AI response:', error);
      throw error;
    }
  }

  async generateInfoSearchQuery(userMessage: string): Promise<InfoSearchQueryPayload> {
    const request: LlmRequest = {
      systemPrompt: buildInfoSearchQueryPrompt(),
      messages: [
        {
          role: 'USER',
          content: userMessage,
        },
      ],
      temperature: 0.1,
      maxTokens: 200,
    };

    const payload = await this.coreAiService.generateJson<InfoSearchQueryPayload>(request);
    if (
      payload &&
      typeof payload.searchQuery === 'string' &&
      payload.searchQuery.trim().length > 0 &&
      (!payload.topic || typeof payload.topic === 'string')
    ) {
      return {
        searchQuery: payload.searchQuery.trim(),
        topic: payload.topic?.trim(),
      };
    }

    // Fallback keeps INFO pipeline operational when JSON output fails.
    return {
      searchQuery: userMessage.trim(),
      topic: undefined,
    };
  }

  async generateWeeklyNarrative(input: {
    isoWeek: number;
    isoYear: number;
    weekStart: string;
    weekEnd: string;
    completionRate: number;
    totalTasks: number;
    completedTasks: number;
    reschedules: number;
    activePatterns: string[];
    completionsByBucket: Record<string, number>;
    recentReflections: string[];
    activeGoals: Array<{ name: string; progressPct: number }>;
  }): Promise<WeeklyNarrativePayload | null> {
    const request: LlmRequest = {
      systemPrompt: buildWeeklySummaryPrompt(),
      messages: [
        {
          role: 'USER',
          content: JSON.stringify(input),
        },
      ],
      temperature: 0.4,
      maxTokens: 700,
    };

    const payload = await this.coreAiService.generateJson<WeeklyNarrativePayload>(request);
    if (
      payload &&
      typeof payload.narrative === 'string' &&
      typeof payload.focusSuggestion === 'string' &&
      Array.isArray(payload.topPatterns) &&
      payload.topPatterns.every(item => typeof item === 'string')
    ) {
      return {
        narrative: payload.narrative.trim(),
        focusSuggestion: payload.focusSuggestion.trim(),
        topPatterns: payload.topPatterns
          .map(item => item.trim().toLowerCase())
          .filter(item => item.length > 0)
          .slice(0, 3),
      };
    }

    return null;
  }

  async classifyInfoQuery(
    userMessage: string,
  ): Promise<{ mode: 'truthlens' | 'digest'; rewrittenQuery: string }> {
    const request: LlmRequest = {
      systemPrompt: buildTruthLensClassifierPrompt(),
      messages: [
        {
          role: 'USER',
          content: userMessage,
        },
      ],
      temperature: 0.1,
      maxTokens: 200,
    };

    const payload = await this.coreAiService.generateJson<{
      mode?: unknown;
      rewrittenQuery?: unknown;
    }>(request);

    const mode =
      payload?.mode === 'truthlens' || payload?.mode === 'digest' ? payload.mode : 'digest';
    const rewrittenRaw =
      typeof payload?.rewrittenQuery === 'string' ? payload.rewrittenQuery.trim() : '';
    const rewrittenQuery = rewrittenRaw.length >= 3 ? rewrittenRaw : userMessage.trim();
    return { mode, rewrittenQuery };
  }

  async generateTruthLensDigest(
    userMessage: string,
    searchResults: SearchResult[],
  ): Promise<TruthLensPayload | null> {
    const compactResults = searchResults.slice(0, 8).map(result => ({
      title: result.title,
      snippet: result.snippet,
      url: result.url,
      publishedAt: result.publishedAt,
    }));

    const request: LlmRequest = {
      systemPrompt: buildTruthLensDigestPrompt(),
      messages: [
        {
          role: 'USER',
          content: JSON.stringify({ question: userMessage, results: compactResults }),
        },
      ],
      temperature: 0.2,
      maxTokens: 900,
    };

    const payload = await this.coreAiService.generateJson<TruthLensPayload>(request);
    if (!payload || !this.isValidTruthLensPayload(payload)) {
      return null;
    }
    return this.normalizeTruthLensPayload(payload);
  }

  private isValidTruthLensPayload(payload: TruthLensPayload): boolean {
    if (typeof payload.title !== 'string' || typeof payload.question !== 'string') return false;
    if (!Array.isArray(payload.perspectives) || payload.perspectives.length < 2) return false;
    if (!['low', 'medium', 'high'].includes(payload.confidence)) return false;
    return payload.perspectives.every(
      perspective =>
        typeof perspective.label === 'string' &&
        typeof perspective.claim === 'string' &&
        Array.isArray(perspective.evidence) &&
        Array.isArray(perspective.limitations),
    );
  }

  private normalizeTruthLensPayload(payload: TruthLensPayload): TruthLensPayload {
    const trimList = (items: string[]): string[] =>
      items
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(item => item.length > 0);
    return {
      title: payload.title.trim().slice(0, 120),
      question: payload.question.trim().slice(0, 200),
      perspectives: payload.perspectives.slice(0, 3).map(perspective => ({
        label: perspective.label.trim().slice(0, 32) || 'Perspective',
        claim: perspective.claim.trim().slice(0, 320),
        evidence: trimList(perspective.evidence).slice(0, 5),
        limitations: trimList(perspective.limitations).slice(0, 3),
      })),
      consensus:
        typeof payload.consensus === 'string' && payload.consensus.trim().length > 0
          ? payload.consensus.trim().slice(0, 240)
          : null,
      openQuestions: trimList(payload.openQuestions ?? []).slice(0, 4),
      confidence: payload.confidence,
    };
  }

  async generateInfoDigestSummary(searchResults: SearchResult[]): Promise<InfoDigestPayload> {
    const compactResults = searchResults.slice(0, 8).map(result => ({
      title: result.title,
      snippet: result.snippet,
      url: result.url,
      publishedAt: result.publishedAt,
    }));

    const request: LlmRequest = {
      systemPrompt: buildInfoDigestSummarizationPrompt(),
      messages: [
        {
          role: 'USER',
          content: JSON.stringify({ results: compactResults }),
        },
      ],
      temperature: 0.2,
      maxTokens: 600,
    };

    const payload = await this.coreAiService.generateJson<InfoDigestPayload>(request);
    if (
      payload &&
      typeof payload.title === 'string' &&
      Array.isArray(payload.highlights) &&
      payload.highlights.every(item => typeof item === 'string')
    ) {
      return {
        title: payload.title.trim(),
        highlights: payload.highlights.map(item => item.trim()).filter(Boolean),
      };
    }

    // Fallback avoids blocking INFO mode when model output is malformed.
    return {
      title: 'Information digest',
      highlights: compactResults.slice(0, 3).map(result => result.snippet || result.title),
    };
  }

  /**
   * Map Prisma ConversationMode to ai-core ConversationMode
   * Both enums have the same string values, so we can safely cast them
   */
  private mapConversationMode(mode: ConversationMode): CoreConversationMode {
    return mode as unknown as CoreConversationMode;
  }

  /**
   * Map Prisma MessageRole to ai-core MessageRole
   * Both enums have the same string values, so we can safely cast them
   */
  private mapMessageRole(role: MessageRole): CoreMessageRole {
    return role as unknown as CoreMessageRole;
  }

  /**
   * Map Prisma Message to ai-core Message
   */
  private mapMessage(message: Message): CoreMessage {
    return {
      role: this.mapMessageRole(message.role),
      content: message.content,
    };
  }

  /**
   * Map Prisma UserProfile to ai-core UserProfile
   */
  private mapUserProfile(profile: UserProfile): CoreUserProfile {
    return {
      displayName: profile.displayName,
      tone: profile.tone,
      verbosity: profile.verbosity,
      useEmoji: profile.useEmoji,
    };
  }

  /**
   * Map Prisma Memory to ai-core Memory
   */
  private mapMemory(memory: Memory): CoreMemory {
    return {
      content: memory.content,
      importance: memory.importance,
      tags: memory.tags,
      layer: memory.layer,
      contextBucket: memory.contextBucket,
    };
  }

  private mapDayContext(day: DayContext): CoreDayContext {
    return {
      date: day.date,
      state: day.state,
    };
  }

  private mapTaskContext(task: TaskContext): CoreTaskContext {
    return {
      id: task.id,
      name: task.name,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline,
    };
  }
}
