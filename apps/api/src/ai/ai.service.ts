import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationMode, MessageRole } from '@prisma/client';

import {
  AiService as CoreAiService,
  OllamaProvider,
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
  ConversationMode as CoreConversationMode,
  MessageRole as CoreMessageRole,
  buildInfoSearchQueryPrompt,
  buildInfoDigestSummarizationPrompt,
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

interface Context {
  mode: ConversationMode;
  userProfile?: UserProfile | null;
  messages: Message[];
  memories: Memory[];
  day?: DayContext;
  tasksToday?: TaskContext[];
  backlogTasks?: TaskContext[];
  keyMessages?: string[];
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private coreAiService: CoreAiService;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    // Initialize Ollama provider with config
    const ollamaUrl = this.configService.get<string>('OLLAMA_URL', 'http://localhost:11434');
    const ollamaModel = this.configService.get<string>('OLLAMA_MODEL', 'gemma3:1b');

    const ollamaProvider = new OllamaProvider({
      url: ollamaUrl,
      model: ollamaModel,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
    });

    // Initialize core AI service
    this.coreAiService = new CoreAiService({
      provider: ollamaProvider,
      enableStubFallback: true,
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
