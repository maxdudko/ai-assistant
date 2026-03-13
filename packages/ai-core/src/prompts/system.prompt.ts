/**
 * System prompt builder
 *
 * Constructs the complete system prompt with user context,
 * mode instructions, and relevant memories
 */

import type { ConversationContext, TaskContext } from '../types/index.js';
import { ConversationMode } from '../types/index.js';

import { getModePrompt } from './mode.prompts.js';

/**
 * Build the complete system prompt
 */
export function buildSystemPrompt(context: ConversationContext): string {
  const modePrompt = getModePrompt(context.mode);

  let prompt = `You are Mira.

Mira is a thoughtful personal AI companion designed to help users think, plan and reflect.

Personality:
- calm
- thoughtful
- supportive
- concise
- observant

Communication style:
- short responses
- clear language
- gentle suggestions instead of commands
- asks thoughtful questions

Mira never pressures the user.
Mira respects the user's autonomy.

Core principles:
- clarity over productivity
- small steps create progress
- reflection leads to growth

Behavior:
- encourage reflection
- help structure thoughts
- suggest small actionable steps
- avoid long explanations

Response style:
- concise
- friendly
- calm
- intelligent
\n\n${modePrompt}\n\n`;

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

  if (context.mode === ConversationMode.MANAGER) {
    if (context.day) {
      prompt += `Current day:\n`;
      prompt += `- dayState: ${context.day.state}\n`;
      prompt += `- date: ${context.day.date}\n\n`;
    }

    const tasksToday = formatTaskList(context.tasksToday);
    prompt += `Tasks today:\n${tasksToday}\n\n`;

    const backlogTasks = formatTaskList(context.backlogTasks);
    prompt += `Backlog tasks:\n${backlogTasks}\n\n`;
  }

  if (context.mode === ConversationMode.REFLECTION) {
    if (context.day) {
      prompt += `Reflection context:\n`;
      prompt += `- date: ${context.day.date}\n`;
      prompt += `- dayState: ${context.day.state}\n`;
    } else {
      prompt += `Reflection context:\n`;
    }

    const tasksToday = formatTaskList(context.tasksToday);
    prompt += `Tasks today:\n${tasksToday}\n\n`;

    if (context.keyMessages && context.keyMessages.length > 0) {
      prompt += `Key messages:\n`;
      context.keyMessages.forEach((message, idx) => {
        prompt += `${idx + 1}. ${message}\n`;
      });
      prompt += `\n`;
    }
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

function formatTaskList(tasks?: TaskContext[]): string {
  if (!tasks || tasks.length === 0) {
    return '- (none)';
  }

  return tasks
    .map(task => {
      const status = task.status ? task.status.toUpperCase() : 'TODO';
      const priority = task.priority ? ` (${task.priority})` : '';
      const deadline = task.deadline ? ` due ${task.deadline}` : '';
      return `- [${status === 'DONE' ? 'x' : ' '}] ${task.name}${priority}${deadline}`;
    })
    .join('\n');
}
