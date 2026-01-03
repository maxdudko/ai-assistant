/**
 * Message formatter
 *
 * Formats conversation messages for LLM consumption
 */

import type { Message } from '../types/index.js';
import { MessageRole } from '../types/index.js';

/**
 * Format messages for prompt inclusion
 */
export function formatMessages(messages: Message[]): string {
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
 * Convert messages to LLM request format
 */
export function messagesToLlmFormat(messages: Message[]): Array<{ role: string; content: string }> {
  return messages.map(msg => ({
    role:
      msg.role === MessageRole.USER
        ? 'USER'
        : msg.role === MessageRole.ASSISTANT
          ? 'ASSISTANT'
          : 'SYSTEM',
    content: msg.content,
  }));
}
