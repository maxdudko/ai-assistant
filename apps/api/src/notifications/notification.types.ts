import type { NotificationType } from '@prisma/client';

export type DispatchNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  deepLink?: string;
  conversationId?: string;
  messageId?: string;
  dayId?: string;
  dedupeKey?: string;
};
