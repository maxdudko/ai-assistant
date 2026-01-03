/**
 * Ollama LLM Provider
 *
 * Implements the LlmProvider interface for Ollama API
 */

import type { LlmRequest, LlmResponse } from '../types/index.js';

import type { LlmProvider } from './llm.provider.interface.js';

export interface OllamaConfig {
  url: string;
  model: string;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export class OllamaProvider implements LlmProvider {
  private readonly config: Required<OllamaConfig>;

  constructor(config: OllamaConfig) {
    this.config = {
      url: config.url || 'http://localhost:11434',
      model: config.model || 'gemma3:1b',
      temperature: config.temperature ?? 0.7,
      topP: config.topP ?? 0.9,
      topK: config.topK ?? 40,
    };
  }

  getName(): string {
    return 'ollama';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.url}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(request: LlmRequest): Promise<LlmResponse> {
    // Convert messages to Ollama format
    // Ollama uses a single prompt string, so we combine system + messages
    const prompt = this.buildOllamaPrompt(request);

    const url = `${this.config.url}/api/generate`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt,
          stream: false,
          options: {
            temperature: request.temperature ?? this.config.temperature,
            top_p: this.config.topP,
            top_k: this.config.topK,
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

      return {
        content: data.response.trim(),
      };
    } catch (error) {
      if (error instanceof Error) {
        // Check if it's a connection error
        if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
          throw new Error(
            `Ollama is not available at ${this.config.url}. Please ensure Ollama is running and the model ${this.config.model} is installed.`,
          );
        }
        throw error;
      }
      throw new Error('Unknown error calling Ollama API');
    }
  }

  /**
   * Build a single prompt string from system prompt and messages
   * Ollama doesn't support separate system messages, so we combine them
   */
  private buildOllamaPrompt(request: LlmRequest): string {
    let prompt = '';

    if (request.systemPrompt) {
      prompt += `System Instructions:\n${request.systemPrompt}\n\n`;
    }

    if (request.messages && request.messages.length > 0) {
      prompt += 'Previous conversation:\n';
      request.messages.forEach(msg => {
        const roleLabel =
          msg.role === 'USER' ? 'User' : msg.role === 'ASSISTANT' ? 'Assistant' : 'System';
        prompt += `${roleLabel}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    // Get the last user message if available
    const lastUserMessage = request.messages
      ?.slice()
      .reverse()
      .find(msg => msg.role === 'USER');

    if (lastUserMessage) {
      prompt += `Current user message: ${lastUserMessage.content}\n\n`;
    }

    prompt +=
      'Please provide a helpful response based on the system instructions and conversation context.';

    return prompt;
  }
}
