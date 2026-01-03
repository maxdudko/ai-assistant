import { apiFetch } from './client';
import type {
  ConversationDto,
  SendMessageRequest,
  SendMessageResponse,
  SwitchModeRequest,
} from './types';

export async function getDailyConversation(): Promise<ConversationDto> {
  return apiFetch<ConversationDto>('/conversations/daily');
}

export async function getConversation(id: string): Promise<ConversationDto> {
  return apiFetch<ConversationDto>(`/conversations/${id}`);
}

export async function getConversations(includeArchived = false): Promise<ConversationDto[]> {
  return apiFetch<ConversationDto[]>(
    `/conversations?includeArchived=${includeArchived}`,
  );
}

export async function sendMessage(
  request: SendMessageRequest,
): Promise<SendMessageResponse> {
  return apiFetch<SendMessageResponse>('/conversations/message', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function createAdHocConversation(
  mode: ConversationDto['mode'] = 'COMPANION',
): Promise<ConversationDto> {
  return apiFetch<ConversationDto>('/conversations/ad-hoc', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

export async function switchMode(
  conversationId: string,
  request: SwitchModeRequest,
): Promise<ConversationDto> {
  return apiFetch<ConversationDto>(`/conversations/${conversationId}/mode`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

export async function archiveConversation(
  conversationId: string,
): Promise<ConversationDto> {
  return apiFetch<ConversationDto>(`/conversations/${conversationId}/archive`, {
    method: 'PATCH',
  });
}

