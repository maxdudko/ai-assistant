'use client';

import type { FC } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import Editor from '@uiw/react-md-editor';

import type { ConversationDto, MessageDto, ConversationMode } from '@/lib/api/types';
import {
  getDailyConversation,
  getConversation,
  sendMessage as sendMessageApi,
  switchMode as switchModeApi,
} from '@/lib/api/conversations';

interface ChatProps {
  conversationId?: string;
}

const Chat: FC<ChatProps> = ({ conversationId }) => {
  const [conversation, setConversation] = useState<ConversationDto | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation on mount or when conversationId changes
  useEffect(() => {
    loadConversation();
  }, [conversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversation = async () => {
    try {
      setLoading(true);
      setError(null);
      const conv = conversationId
        ? await getConversation(conversationId)
        : await getDailyConversation();
      setConversation(conv);
      setMessages(conv.messages || []);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || loading) return;

      const userMessage = input.trim();
      setInput('');
      setError(null);

      // Optimistically add user message
      const tempUserMessage: MessageDto = {
        id: `temp-${Date.now()}`,
        role: 'USER',
        content: userMessage,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempUserMessage]);

      try {
        const response = await sendMessageApi({
          message: userMessage,
          conversationId: conversation?.id,
        });

        // Update conversation and messages
        if (response.conversationId !== conversation?.id) {
          // New conversation created, reload it
          await loadConversation();
        } else {
          // Add assistant response
          setMessages(prev => [...prev, response.message]);
        }
      } catch (err) {
        console.error('Failed to send message:', err);
        setError('Failed to send message');
        // Remove optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
      }
    },
    [input, loading, conversation],
  );

  const handleModeSwitch = useCallback(
    async (mode: ConversationMode) => {
      if (!conversation || conversation.mode === mode) return;

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

  if (loading && !conversation) {
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
    <div className="flex h-full flex-col">
      {/* Header */}
      {conversation && (
        <div className="mb-4 flex items-center justify-between rounded bg-[#0D1117] p-3">
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
        </div>
      )}

      {/* Mode selector */}
      {conversation && (
        <div className="mb-4 flex gap-2 rounded bg-[#0D1117] p-2">
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
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto rounded bg-[#0D1117] p-4">
        {messages.length === 0 ? (
          <ReactMarkdown>
            PMA: How can I help you today? Start by planning your day or asking a question.
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
                <div className="font-medium mb-1 underline">
                  {message.role === 'USER' && 'You'}
                  {message.role === 'ASSISTANT' && 'AI Assistant'}
                  {message.role === 'SYSTEM' && 'System'}
                </div>
                <ReactMarkdown>{message.content}</ReactMarkdown>
                <p className="text-xs text-right mt-2">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && <div className="mt-2 rounded bg-red-900/50 p-2 text-sm text-red-300">{error}</div>}

      {/* Input form */}
      <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
        {/*<textarea*/}
        {/*  rows={5}*/}
        {/*  value={input}*/}
        {/*  onChange={e => setInput(e.target.value)}*/}
        {/*  className="flex-1 rounded bg-neutral-800 p-2 text-neutral-200 placeholder:text-neutral-500"*/}
        {/*  placeholder="Type your message..."*/}
        {/*  disabled={loading}*/}
        {/*/>*/}
        <Editor className="w-full bg-neutral-900" value={input} onChange={setInput} />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded bg-indigo-600 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default Chat;
