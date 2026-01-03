/**
 * OpenAI LLM Provider
 *
 * Implements the LlmProvider interface for OpenAI API
 * Ready for future implementation
 */

import { LlmRequest, LlmResponse } from '../types/index.js';
import { LlmProvider } from './llm.provider.interface.js';

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}

export class OpenAIProvider implements LlmProvider {
  private readonly config: Required<Omit<OpenAIConfig, 'apiKey'>> & { apiKey: string };

  constructor(config: OpenAIConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'gpt-4o-mini',
      baseURL: config.baseURL || 'https://api.openai.com/v1',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2000,
    };
  }

  getName(): string {
    return 'openai';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseURL}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const url = `${this.config.baseURL}/chat/completions`;

    // Convert messages to OpenAI format
    const messages: Array<{ role: string; content: string }> = [];

    // Add system message
    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt,
      });
    }

    // Add conversation messages
    if (request.messages) {
      request.messages.forEach(msg => {
        messages.push({
          role: msg.role.toLowerCase(),
          content: msg.content,
        });
      });
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: request.temperature ?? this.config.temperature,
          max_tokens: request.maxTokens ?? this.config.maxTokens,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('OpenAI API returned invalid response');
      }

      return {
        content: data.choices[0].message.content.trim(),
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error calling OpenAI API');
    }
  }
}
