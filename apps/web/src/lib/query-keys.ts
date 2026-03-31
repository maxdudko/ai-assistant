export const queryKeys = {
  tasks: ['tasks'] as const,
  goals: ['goals'] as const,
  morningBriefing: ['morningBriefing'] as const,
  conversations: (includeArchived: boolean) => ['conversations', includeArchived] as const,
  conversation: (id: string) => ['conversation', id] as const,
};
