'use client';

import type { FC } from 'react';
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActionCandidate } from '@ai/shared-types';

import type {
  ConversationDto,
  MessageDto,
  ConversationMode,
  SendMessageResponse,
} from '@/lib/api/types';
import {
  getDailyConversation,
  getConversation,
  sendMessageStream as sendMessageStreamApi,
  switchMode as switchModeApi,
} from '@/lib/api/conversations';
import { confirmAction as confirmActionApi } from '@/lib/api/actions';
import Container from '@/components/common/container';
import { useAuth } from '@/lib/api/AuthContext';
import { queryKeys } from '@/lib/query-keys';

interface ChatProps {
  conversationId?: string;
}

type ChatMessage = MessageDto & { actions?: ActionCandidate[] };

const STREAM_CHUNK_CHARS = 16;

function MessageBody({
  message,
  streamingMessageId,
}: {
  message: ChatMessage;
  streamingMessageId: string | null;
}) {
  if (message.role === 'ASSISTANT' && message.id === streamingMessageId) {
    return (
      <div className="whitespace-pre-wrap break-words" dir="auto">
        {message.content}
      </div>
    );
  }

  if (!message.content) {
    return null;
  }

  return <ReactMarkdown>{message.content}</ReactMarkdown>;
}

const Chat: FC<ChatProps> = ({ conversationId }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const convIdKey = conversationId ?? 'daily';
  const [conversation, setConversation] = useState<ConversationDto | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);
  const [executedActionIds, setExecutedActionIds] = useState<string[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const streamingBufferRef = useRef('');
  const streamingDisplayedRef = useRef('');
  const rafIdRef = useRef<number | null>(null);
  const streamingPendingCompleteRef = useRef<SendMessageResponse | null>(null);

  const {
    data: queryConversation,
    isPending: conversationPending,
    isError: conversationQueryError,
    refetch: refetchConversation,
  } = useQuery({
    queryKey: queryKeys.conversation(convIdKey),
    queryFn: () => (conversationId ? getConversation(conversationId) : getDailyConversation()),
  });

  useLayoutEffect(() => {
    if (!queryConversation) {
      return;
    }
    if (streamingMessageIdRef.current) {
      return;
    }
    setConversation(queryConversation);
    setMessages((queryConversation.messages || []) as ChatMessage[]);
  }, [queryConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  const resetStreamingAnimation = useCallback(() => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    streamingBufferRef.current = '';
    streamingMessageIdRef.current = null;
    streamingDisplayedRef.current = '';
    streamingPendingCompleteRef.current = null;
    setStreamingMessageId(null);
  }, []);

  const tickStream = useCallback(() => {
    rafIdRef.current = null;
    const messageId = streamingMessageIdRef.current;
    if (!messageId) {
      return;
    }

    if (!streamingBufferRef.current.length) {
      const pending = streamingPendingCompleteRef.current;
      if (pending) {
        setMessages(prev => {
          const i = prev.findIndex(m => m.id === messageId);
          if (i === -1) {
            return prev;
          }
          const next = [...prev];
          next[i] = { ...pending.message, actions: pending.actions || [] };
          return next;
        });
        resetStreamingAnimation();
      }
      return;
    }

    const take = Math.min(STREAM_CHUNK_CHARS, streamingBufferRef.current.length);
    const chunk = streamingBufferRef.current.slice(0, take);
    streamingBufferRef.current = streamingBufferRef.current.slice(take);
    streamingDisplayedRef.current += chunk;

    setMessages(prev => {
      const i = prev.findIndex(m => m.id === messageId);
      if (i === -1) {
        return prev;
      }
      const next = [...prev];
      const msg = next[i];
      next[i] = { ...msg, content: `${msg.content}${chunk}` };
      return next;
    });

    rafIdRef.current = requestAnimationFrame(tickStream);
  }, [resetStreamingAnimation]);

  const queueStreamingDelta = useCallback(
    (delta: string) => {
      if (!streamingMessageIdRef.current) {
        return;
      }
      streamingBufferRef.current += delta;
      if (rafIdRef.current != null) {
        return;
      }
      rafIdRef.current = requestAnimationFrame(tickStream);
    },
    [tickStream],
  );

  useEffect(() => {
    return () => {
      resetStreamingAnimation();
    };
  }, [resetStreamingAnimation]);

  const loadConversation = useCallback(async () => {
    await refetchConversation();
  }, [refetchConversation]);

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || sending) {
        return;
      }

      const userMessage = input.trim();
      setInput('');
      setError(null);
      setSending(true);

      const tempUserMessage: MessageDto = {
        id: `temp-${Date.now()}`,
        role: 'USER',
        content: userMessage,
        mode: conversation?.mode || 'MANAGER',
        createdAt: new Date().toISOString(),
      };
      const tempAssistantMessage: ChatMessage = {
        id: `temp-assistant-${Date.now()}`,
        role: 'ASSISTANT',
        content: '',
        mode: conversation?.mode || 'MANAGER',
        createdAt: new Date().toISOString(),
      };
      streamingMessageIdRef.current = tempAssistantMessage.id;
      setStreamingMessageId(tempAssistantMessage.id);
      streamingDisplayedRef.current = '';
      streamingPendingCompleteRef.current = null;
      setMessages(prev => [...prev, tempUserMessage, tempAssistantMessage]);

      try {
        const response = await sendMessageStreamApi(
          {
            message: userMessage,
            conversationId: conversation?.id,
          },
          {
            onDelta: delta => queueStreamingDelta(delta),
            onComplete: result => {
              streamingPendingCompleteRef.current = result;

              const alreadyShown = streamingDisplayedRef.current;
              const full = result.message.content || '';
              const remaining = full.startsWith(alreadyShown)
                ? full.slice(alreadyShown.length)
                : full;

              if (remaining.length) {
                queueStreamingDelta(remaining);
                return;
              }

              setMessages(prev =>
                prev.map(msg =>
                  msg.id === tempAssistantMessage.id
                    ? { ...result.message, actions: result.actions || [] }
                    : msg,
                ),
              );
              resetStreamingAnimation();
            },
          },
        );

        if (response.conversationId !== conversation?.id) {
          await loadConversation();
        }
      } catch (err) {
        console.error('Failed to send message:', err);
        setError('Failed to send message');
        resetStreamingAnimation();
        setMessages(prev =>
          prev.filter(msg => msg.id !== tempUserMessage.id && msg.id !== tempAssistantMessage.id),
        );
      } finally {
        setSending(false);
      }
    },
    [input, sending, conversation, queueStreamingDelta, resetStreamingAnimation, loadConversation],
  );

  const handleConfirmAction = useCallback(
    async (action: ActionCandidate) => {
      if (confirmingActionId || executedActionIds.includes(action.id)) {
        return;
      }

      try {
        setConfirmingActionId(action.id);
        setError(null);
        const result = await confirmActionApi({ actionId: action.id });
        if (result.status === 'EXECUTED') {
          setExecutedActionIds(prev => (prev.includes(action.id) ? prev : [...prev, action.id]));
          void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
        }
      } catch (err) {
        console.error('Failed to confirm action:', err);
        setError('Failed to confirm action');
      } finally {
        setConfirmingActionId(null);
      }
    },
    [confirmingActionId, executedActionIds, queryClient],
  );

  const getActionLabel = (action: ActionCandidate): string => {
    const payload = action.payload as Record<string, unknown>;
    const title =
      (typeof payload.title === 'string' && payload.title) ||
      (typeof payload.name === 'string' && payload.name) ||
      (typeof payload.taskName === 'string' && payload.taskName) ||
      (typeof payload.task === 'string' && payload.task) ||
      (typeof payload.topic === 'string' && payload.topic);

    switch (action.type) {
      case 'TASK_CREATE':
        return `Create task${title ? `: ${title}` : ''}`;
      case 'TASK_UPDATE_STATUS':
      case 'TASK_COMPLETE':
        return `Mark task as done${title ? `: ${title}` : ''}`;
      case 'TASK_SET_PRIORITY':
        return `Set task priority${title ? ` for ${title}` : ''}`;
      case 'TASK_SET_DUE_DATE':
        return `Set task due date${title ? ` for ${title}` : ''}`;
      case 'DAY_START':
        return 'Start the day';
      case 'DAY_END':
        return 'End the day';
      case 'SUGGEST_DIGEST_SUBSCRIPTION':
        return `Subscribe to daily digest${title ? `: ${title}` : ''}`;
      default:
        return 'Confirm action';
    }
  };

  const handleModeSwitch = useCallback(
    async (mode: ConversationMode) => {
      if (!conversation || conversation.mode === mode) {
        return;
      }

      try {
        const updated = await switchModeApi(conversation.id, { mode });
        setConversation(updated);
      } catch (err) {
        console.error('Failed to switch mode:', err);
        setError('Failed to switch mode');
      }
    },
    [conversation],
  );

  const getModeLabel = (mode: ConversationMode): string => {
    const labels = {
      MANAGER: 'Manager',
      REFLECTION: 'Reflection',
      COMPANION: 'Companion',
      INFO: 'Info',
    };
    return labels[mode] || mode;
  };

  if (conversationQueryError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-400">Failed to load conversation</div>
      </div>
    );
  }

  if (conversationPending || !queryConversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-neutral-400">Loading conversation...</div>
      </div>
    );
  }

  const getTypeLabel = (type: string): string => {
    return type === 'DAILY' ? 'Daily' : 'Ad-hoc';
  };

  return (
    <div className="flex h-full max-w-full flex-col">
      {conversation && (
        <Container className="mb-4 p-3 shrink-0">
          <div className="flex items-center gap-3">
            <Link
              href="/me/conversations"
              className="text-sm text-neutral-400 hover:text-neutral-200 underline"
            >
              ← Conversations
            </Link>
            <span className="text-neutral-500">|</span>
            <span className="text-sm font-medium text-neutral-300">
              {getTypeLabel(conversation.type)} Conversation
            </span>
            <span
              className={`rounded border px-2 py-0.5 text-xs ${
                conversation.type === 'DAILY'
                  ? 'bg-blue-600/20 text-blue-400 border-blue-600/50'
                  : 'bg-purple-600/20 text-purple-400 border-purple-600/50'
              }`}
            >
              {conversation.state}
            </span>
          </div>
        </Container>
      )}

      {conversation && (
        <Container className="mb-4 flex gap-2 p-2 flex-shrink-0">
          <span className="text-sm text-neutral-400">Mode:</span>
          {(['MANAGER', 'REFLECTION', 'COMPANION', 'INFO'] as ConversationMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => handleModeSwitch(mode)}
              className={`rounded px-3 py-1 text-sm ${
                conversation.mode === mode
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600 cursor-pointer'
              }`}
            >
              {getModeLabel(mode)}
            </button>
          ))}
        </Container>
      )}

      <Container className="flex-1 space-y-2 overflow-y-auto p-4 min-h-0">
        {messages.length === 0 ? (
          <ReactMarkdown>
            Mira: How can I help you today? Start by planning your day or asking a question.
          </ReactMarkdown>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'USER' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] min-w-[20%] rounded-lg px-3 py-2 text-sm ${
                  message.role === 'USER'
                    ? 'bg-[#212121] border border-indigo-400 text-white'
                    : message.role === 'SYSTEM'
                      ? 'bg-neutral-800 text-neutral-400'
                      : 'bg-[#212121] border border-indigo-800 text-neutral-200'
                }`}
              >
                <div className="font-medium mb-1 flex items-center justify-between">
                  <span className="font-bold">
                    {message.role === 'USER' && '✨ ' + (user?.profile?.displayName || 'You')}
                    {message.role === 'ASSISTANT' && '💕 Mira'}
                    {message.role === 'SYSTEM' && 'System'}
                  </span>
                  <span className="text-xs font-normal opacity-70 ml-2">
                    {getModeLabel(message.mode)}
                  </span>
                </div>
                <MessageBody message={message} streamingMessageId={streamingMessageId} />
                {message.role === 'ASSISTANT' && message.actions && message.actions.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {message.actions.map(action => {
                      console.log(action);
                      const executed = executedActionIds.includes(action.id);
                      const confirming = confirmingActionId === action.id;
                      return (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => handleConfirmAction(action)}
                          disabled={executed || confirming}
                          className={`rounded border px-3 py-1 text-xs text-left cursor-pointer ${
                            executed
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : 'border-indigo-600/40 bg-indigo-600/10 text-indigo-200 hover:bg-indigo-600/20'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {executed ? 'Action completed' : 'Confirm'}: {getActionLabel(action)}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-right mt-2">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </Container>

      {error && (
        <div className="mt-2 rounded bg-red-900/50 p-2 text-sm text-red-300 flex-shrink-0">
          {error}
        </div>
      )}

      <Container className="mt-2 flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <textarea
            rows={5}
            value={input}
            onChange={e => setInput(e.target.value)}
            className="flex-1 rounded  p-2 text-neutral-200 placeholder:text-neutral-500"
            placeholder="Type your message..."
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded bg-indigo-600 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </Container>
    </div>
  );
};

export default Chat;
