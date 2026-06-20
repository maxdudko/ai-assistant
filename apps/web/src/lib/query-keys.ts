export const queryKeys = {
  tasks: ['tasks'] as const,
  goals: ['goals'] as const,
  morningBriefing: ['morningBriefing'] as const,
  dayIntelligence: ['dayIntelligence'] as const,
  pendingActions: (scope?: string) => ['pendingActions', scope ?? 'all'] as const,
  conversations: (includeArchived: boolean) => ['conversations', includeArchived] as const,
  conversation: (id: string) => ['conversation', id] as const,
};
