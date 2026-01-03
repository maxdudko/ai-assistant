/**
 * System prompt builder
 *
 * Constructs the complete system prompt with user context,
 * mode instructions, and relevant memories
 */

import { ConversationContext, ConversationMode } from '../types/index.js';
import { getModePrompt } from './mode.prompts.js';

/**
 * Build the complete system prompt
 */
export function buildSystemPrompt(context: ConversationContext): string {
  const modePrompt = getModePrompt(context.mode);

  let prompt = `You are PMA (Personal Management Assistant), an AI assistant that helps users with their daily flow.\n\n${modePrompt}\n\n`;

  // Add user profile information
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

  // Add relevant memories
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
