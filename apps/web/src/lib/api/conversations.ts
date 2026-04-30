import { apiFetch, fetchWithAuth, redirectToLoginIfUnauthorized } from './client';
import type {
  ConversationDto,
  PaginatedList,
  SendMessageRequest,
  SendMessageResponse,
  SendMessageStreamEvent,
  SwitchModeRequest,
} from './types';

export async function getDailyConversation(): Promise<ConversationDto> {
  return apiFetch<ConversationDto>('/api/conversations/daily');
}

export async function getConversation(id: string): Promise<ConversationDto> {
  return apiFetch<ConversationDto>(`/api/conversations/${id}`);
}

export async function getConversations(
  includeArchived = false,
  options?: { limit?: number; offset?: number },
): Promise<PaginatedList<ConversationDto>> {
  const params = new URLSearchParams();
  params.set('includeArchived', String(includeArchived));
  if (options?.limit != null) params.set('limit', String(options.limit));
  if (options?.offset != null) params.set('offset', String(options.offset));
  return apiFetch<PaginatedList<ConversationDto>>(`/api/conversations?${params.toString()}`);
}

export async function sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
  return apiFetch<SendMessageResponse>('/api/conversations/message', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function sendMessageStream(
  request: SendMessageRequest,
  handlers: {
    onStart?: () => void;
    onDelta?: (delta: string) => void;
    onComplete?: (result: SendMessageResponse) => void;
  },
): Promise<SendMessageResponse> {
  const response = await fetchWithAuth('/api/conversations/message/stream', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    redirectToLoginIfUnauthorized('/api/conversations/message/stream', response.status);
    throw new Error(await response.text());
  }

  if (!response.body) {
    throw new Error('Streaming response body is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResponse: SendMessageResponse | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let lineBreakIndex = buffer.indexOf('\n');

    while (lineBreakIndex !== -1) {
      const line = buffer.slice(0, lineBreakIndex).trim();
      buffer = buffer.slice(lineBreakIndex + 1);

      if (line) {
        const event = JSON.parse(line) as SendMessageStreamEvent;
        if (event.type === 'start') {
          handlers.onStart?.();
        } else if (event.type === 'delta') {
          handlers.onDelta?.(event.delta);
        } else if (event.type === 'complete') {
          const result: SendMessageResponse = {
            conversationId: event.conversationId,
            message: event.message,
            actions: event.actions,
          };
          finalResponse = result;
          handlers.onComplete?.(result);
        } else if (event.type === 'error') {
          throw new Error(event.error || 'Streaming failed');
        }
      }

      lineBreakIndex = buffer.indexOf('\n');
    }
  }

  if (!finalResponse) {
    throw new Error('Streaming completed without a final response');
  }

  return finalResponse;
}

export async function createAdHocConversation(
  mode: ConversationDto['mode'] = 'COMPANION',
): Promise<ConversationDto> {
  return apiFetch<ConversationDto>('/api/conversations/ad-hoc', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

export async function switchMode(
  conversationId: string,
  request: SwitchModeRequest,
): Promise<ConversationDto> {
  return apiFetch<ConversationDto>(`/api/conversations/${conversationId}/mode`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

export async function archiveConversation(conversationId: string): Promise<ConversationDto> {
  return apiFetch<ConversationDto>(`/api/conversations/${conversationId}/archive`, {
    method: 'PATCH',
  });
}
