/**
 * Memory candidate extractor
 *
 * Extracts potential memories from conversations based on heuristics
 * This is a simple implementation - can be enhanced with AI-powered extraction
 */

import type { Memory, MemoryCandidate } from '../types/index.js';
import { ConversationMode } from '../types/index.js';

/**
 * Extract memory candidates from conversation
 */
export function extractMemoryCandidates(
  userMessage: string,
  aiResponse: string,
  mode: ConversationMode,
  existingMemories: Memory[],
): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];

  // In REFLECTION mode, most insights are memory-worthy
  if (mode === ConversationMode.REFLECTION) {
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
        type: 'REFLECTION',
        importance: 7,
        tags: ['reflection', 'insight'],
        confidence: 0.7,
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
        type: 'FACTUAL',
        importance: 8,
        tags: ['planning', 'priority'],
        confidence: 0.8,
      });
    }
  }

  // In COMPANION mode, only very meaningful moments
  // For now, skip most companion conversations
  // This can be enhanced with sentiment analysis or explicit user signals

  return candidates;
}
