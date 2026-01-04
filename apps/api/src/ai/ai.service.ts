import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationMode, MessageRole } from '@prisma/client';

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

interface Context {
  mode: ConversationMode;
  userProfile?: UserProfile;
  messages: Message[];
  memories: Memory[];
}

interface AiResponse {
  content: string;
  memoryCandidates?: Array<{
    content: string;
    importance: number;
    tags?: string[];
  }>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly ollamaUrl: string;
  private readonly ollamaModel: string;

  constructor(private readonly configService: ConfigService) {
    this.ollamaUrl = this.configService.get<string>('OLLAMA_URL', 'http://localhost:11434');
    this.ollamaModel = this.configService.get<string>('OLLAMA_MODEL', 'gemma3:1b');
  }

  /**
   * Generate AI response based on message and context
   */
  async generateResponse(message: string, context: Context): Promise<AiResponse> {
    try {
      // Build mode-specific prompt
      const modePrompt = this.getModePrompt(context.mode);

      // Build system prompt with context
      const systemPrompt = this.buildSystemPrompt(modePrompt, context);

      // Format conversation history
      const conversationHistory = this.formatMessages(context.messages);

      // Build full prompt for Ollama
      const fullPrompt = this.buildOllamaPrompt(systemPrompt, conversationHistory, message);

      // Call Ollama API
      const response = await this.callOllama(fullPrompt);

      // Extract memory candidates based on mode
      const memoryCandidates = this.extractMemoryCandidates(
        message,
        response,
        context.mode,
        context.memories,
      );

      return {
        content: response,
        memoryCandidates: memoryCandidates.length > 0 ? memoryCandidates : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to generate AI response:', error);
      // Fallback to stub response on error
      const fallbackResponse = this.generateStubResponse(
        message,
        context.mode,
        context.userProfile,
      );
      return {
        content: fallbackResponse,
      };
    }
  }

  /**
   * Build prompt for Ollama API
   */
  private buildOllamaPrompt(
    systemPrompt: string,
    conversationHistory: string,
    currentMessage: string,
  ): string {
    // Build a clear, structured prompt for Ollama
    let prompt = `System Instructions:\n${systemPrompt}\n\n`;

    if (conversationHistory) {
      prompt += `Previous conversation:\n${conversationHistory}\n\n`;
    }

    prompt += `Current user message: ${currentMessage}\n\nPlease provide a helpful response based on the system instructions and conversation context.`;

    return prompt;
  }

  /**
   * Call Ollama API to generate response
   */
  private async callOllama(prompt: string): Promise<string> {
    const url = `${this.ollamaUrl}/api/generate`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.ollamaModel,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.response) {
        throw new Error('Ollama API returned no response');
      }

      // Clean up the response (remove any extra whitespace)
      return data.response.trim();
    } catch (error) {
      if (error instanceof Error) {
        // Check if it's a connection error
        if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
          this.logger.warn(
            `Cannot connect to Ollama at ${this.ollamaUrl}. Make sure Ollama is running.`,
          );
          throw new Error(
            `Ollama is not available at ${this.ollamaUrl}. Please ensure Ollama is running and the model ${this.ollamaModel} is installed.`,
          );
        }
        throw error;
      }
      throw new Error('Unknown error calling Ollama API');
    }
  }

  /**
   * Get mode-specific prompt instructions
   */
  private getModePrompt(mode: ConversationMode): string {
    const prompts = {
      [ConversationMode.MANAGER]: `You are a productivity manager. Your role is to:
- Help with planning and task organization
- Ask clarifying questions to understand priorities
- Structure information clearly
- Focus on actionable items
- Avoid philosophical discussions
- Be direct and efficient`,

      [ConversationMode.REFLECTION]: `You are a reflection companion. Your role is to:
- Help summarize the day
- Ask soft, thoughtful questions
- Capture insights and learnings
- Identify patterns and growth
- Create memory-worthy moments
- Be gentle and supportive`,

      [ConversationMode.COMPANION]: `You are a supportive companion. Your role is to:
- Provide empathetic support
- Engage in free dialogue
- Listen actively
- Avoid giving unsolicited advice
- Be warm and understanding
- Not everything needs to be saved to memory`,

      [ConversationMode.INFO]: `You are an information assistant. Your role is to:
- Provide rational, factual summaries
- Be neutral and objective
- Keep responses brief and clear
- Avoid emotional language
- Focus on information without noise
- Be precise and concise`,
    };

    return prompts[mode] || prompts[ConversationMode.MANAGER];
  }

  /**
   * Build system prompt with all context
   */
  private buildSystemPrompt(modePrompt: string, context: Context): string {
    let prompt = `You are PMA (Personal Management Assistant), an AI assistant that helps users with their daily flow.\n\n${modePrompt}\n\n`;

    if (context.userProfile) {
      const profile = context.userProfile;
      prompt += `User Profile:\n`;
      prompt += `- Name: ${profile.displayName || 'User'}\n`;
      prompt += `- Tone preference: ${profile.tone || 'neutral'}\n`;
      prompt += `- Verbosity: ${profile.verbosity || 'medium'}\n`;
      if (profile.useEmoji) {
        prompt += `- Use emojis when appropriate\n`;
      }
      prompt += `\n`;
    }

    if (context.memories && context.memories.length > 0) {
      prompt += `Relevant memories:\n`;
      context.memories.forEach((memory, idx) => {
        prompt += `${idx + 1}. ${memory.content} (importance: ${memory.importance})\n`;
      });
      prompt += `\n`;
    }

    prompt += `Remember: Conversation is contextual. Use the mode and context to provide appropriate responses.`;

    return prompt;
  }

  /**
   * Format messages for prompt
   */
  private formatMessages(messages: Message[]): string {
    return messages
      .map(msg => {
        const role =
          msg.role === MessageRole.USER
            ? 'User'
            : msg.role === MessageRole.ASSISTANT
              ? 'Assistant'
              : 'System';
        return `${role}: ${msg.content}`;
      })
      .join('\n');
  }

  /**
   * Generate stub response (to be replaced with actual LLM)
   */
  private generateStubResponse(
    message: string,
    mode: ConversationMode,
    profile?: UserProfile,
  ): string {
    const modeResponses = {
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

  /**
   * Extract memory candidates from conversation
   */
  private extractMemoryCandidates(
    userMessage: string,
    aiResponse: string,
    mode: ConversationMode,
    existingMemories: Memory[],
  ): Array<{ content: string; importance: number; tags?: string[] }> {
    const candidates: Array<{ content: string; importance: number; tags?: string[] }> = [];

    // In REFLECTION mode, most insights are memory-worthy
    if (mode === ConversationMode.REFLECTION) {
      // Simple heuristic: if user message contains reflection keywords
      const reflectionKeywords = [
        'learned',
        'realized',
        'insight',
        'pattern',
        'growth',
        'understand',
        'important',
      ];
      const hasReflection = reflectionKeywords.some(keyword =>
        userMessage.toLowerCase().includes(keyword),
      );

      if (hasReflection || userMessage.length > 100) {
        candidates.push({
          content: `${userMessage} → ${aiResponse}`,
          importance: 7,
          tags: ['reflection', 'insight'],
        });
      }
    }

    // In MANAGER mode, only high-priority items
    if (mode === ConversationMode.MANAGER) {
      const priorityKeywords = ['important', 'priority', 'goal', 'objective', 'critical'];
      const hasPriority = priorityKeywords.some(keyword =>
        userMessage.toLowerCase().includes(keyword),
      );

      if (hasPriority) {
        candidates.push({
          content: userMessage,
          importance: 8,
          tags: ['planning', 'priority'],
        });
      }
    }

    // In COMPANION mode, only very meaningful moments
    if (mode === ConversationMode.COMPANION) {
      // Only save if explicitly important (would need better detection)
      // For now, skip most companion conversations
    }

    return candidates;
  }
}
