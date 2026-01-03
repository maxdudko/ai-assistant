'use client';

import type { FC } from 'react';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { ConversationDto, ConversationMode, ConversationType } from '@/lib/api/types';
import { getConversations, archiveConversation, createAdHocConversation } from '@/lib/api/conversations';

const ConversationsList: FC = () => {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [includeArchived]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getConversations(includeArchived);
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (archivingId) return;

    try {
      setArchivingId(conversationId);
      await archiveConversation(conversationId);
      await loadConversations();
    } catch (err) {
      console.error('Failed to archive conversation:', err);
      setError('Failed to archive conversation');
    } finally {
      setArchivingId(null);
    }
  };

  const handleCreateNew = async () => {
    if (creating) return;

    try {
      setCreating(true);
      setError(null);
      const newConversation = await createAdHocConversation();
      router.push(`/me/chat/${newConversation.id}`);
    } catch (err) {
      console.error('Failed to create conversation:', err);
      setError('Failed to create conversation');
      setCreating(false);
    }
  };

  const getModeLabel = (mode: ConversationMode): string => {
    const labels = {
      MANAGER: 'Manager',
      REFLECTION: 'Reflection',
      COMPANION: 'Companion',
      INFO: 'Info',
    };
    return labels[mode] || mode;
  };

  const getTypeLabel = (type: ConversationType): string => {
    return type === 'DAILY' ? 'Daily' : 'Ad-hoc';
  };

  const getStateBadgeColor = (state: string): string => {
    switch (state) {
      case 'ACTIVE':
        return 'bg-green-600/20 text-green-400 border-green-600/50';
      case 'CREATED':
        return 'bg-blue-600/20 text-blue-400 border-blue-600/50';
      case 'ARCHIVED':
        return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/50';
      default:
        return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/50';
    }
  };

  const getModeBadgeColor = (mode: ConversationMode): string => {
    switch (mode) {
      case 'MANAGER':
        return 'bg-indigo-600/20 text-indigo-400 border-indigo-600/50';
      case 'REFLECTION':
        return 'bg-purple-600/20 text-purple-400 border-purple-600/50';
      case 'COMPANION':
        return 'bg-pink-600/20 text-pink-400 border-pink-600/50';
      case 'INFO':
        return 'bg-cyan-600/20 text-cyan-400 border-cyan-600/50';
      default:
        return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/50';
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const conversationDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (conversationDate.getTime() === today.getTime()) {
      return 'Today';
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (conversationDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getLastMessagePreview = (conversation: ConversationDto): string => {
    if (conversation.messages && conversation.messages.length > 0) {
      const lastMessage = conversation.messages[0];
      return lastMessage.content.length > 50
        ? `${lastMessage.content.substring(0, 50)}...`
        : lastMessage.content;
    }
    if (conversation._count && conversation._count.messages > 0) {
      return `${conversation._count.messages} message${conversation._count.messages !== 1 ? 's' : ''}`;
    }
    return 'No messages yet';
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-neutral-400">Loading conversations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={e => setIncludeArchived(e.target.checked)}
              className="rounded"
            />
            Show archived
          </label>
          <button
            onClick={handleCreateNew}
            disabled={creating}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : '+ New Conversation'}
          </button>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-neutral-400">
            <p className="mb-2">No conversations yet</p>
            <Link
              href="/me/chat"
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              Start a conversation
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {conversations.map(conversation => (
              <Link
                key={conversation.id}
                href={`/me/chat/${conversation.id}`}
                className="block rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-medium ${getTypeLabel(
                          conversation.type,
                        ) === 'Daily'
                          ? 'bg-blue-600/20 text-blue-400 border-blue-600/50'
                          : 'bg-purple-600/20 text-purple-400 border-purple-600/50'}`}
                      >
                        {getTypeLabel(conversation.type)}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-medium ${getModeBadgeColor(
                          conversation.mode,
                        )}`}
                      >
                        {getModeLabel(conversation.mode)}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-medium ${getStateBadgeColor(
                          conversation.state,
                        )}`}
                      >
                        {conversation.state}
                      </span>
                    </div>
                    <p className="mb-1 text-sm text-neutral-300">
                      {getLastMessagePreview(conversation)}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      <span>{formatDate(conversation.updatedAt)}</span>
                      {conversation._count && conversation._count.messages > 0 && (
                        <span>{conversation._count.messages} messages</span>
                      )}
                    </div>
                  </div>
                  {conversation.state !== 'ARCHIVED' && (
                    <button
                      onClick={e => handleArchive(e, conversation.id)}
                      disabled={archivingId === conversation.id}
                      className="ml-4 rounded px-3 py-1 text-xs text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-50"
                      title="Archive conversation"
                    >
                      {archivingId === conversation.id ? 'Archiving...' : 'Archive'}
                    </button>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationsList;

