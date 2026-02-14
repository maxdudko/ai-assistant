'use client';

import type { FC } from 'react';
import React, { useState, useEffect } from 'react';

import type { MemoryDto, MemoryType, MemorySource } from '@/lib/api/types';
import { getMemories, deleteMemory } from '@/lib/api/memory';

const MemoryList: FC = () => {
  const [memories, setMemories] = useState<MemoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMemories();
      setMemories(data);
    } catch (err) {
      console.error('Failed to load memories:', err);
      setError('Failed to load memories');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this memory? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(id);
      setError(null);
      await deleteMemory(id);
      await loadMemories();
    } catch (err) {
      console.error('Failed to delete memory:', err);
      setError('Failed to delete memory');
    } finally {
      setDeletingId(null);
    }
  };

  const getTypeBadgeColor = (type: MemoryType): string => {
    switch (type) {
      case 'FACTUAL':
        return 'bg-blue-600/20 text-blue-400 border-blue-600/50';
      case 'REFLECTION':
        return 'bg-purple-600/20 text-purple-400 border-purple-600/50';
      default:
        return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/50';
    }
  };

  const getSourceBadgeColor = (source: MemorySource): string => {
    switch (source) {
      case 'CONVERSATION':
        return 'bg-green-600/20 text-green-400 border-green-600/50';
      case 'REFLECTION':
        return 'bg-indigo-600/20 text-indigo-400 border-indigo-600/50';
      case 'ONBOARDING':
        return 'bg-yellow-600/20 text-yellow-400 border-yellow-600/50';
      default:
        return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/50';
    }
  };

  const getImportanceColor = (importance: number): string => {
    if (importance >= 8) return 'text-red-400';
    if (importance >= 6) return 'text-yellow-400';
    return 'text-neutral-400';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-neutral-400">Loading memories...</div>
      </div>
    );
  }

  if (error && memories.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Memories</h1>
        <button
          onClick={loadMemories}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-600/20 border border-red-600/50 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {memories.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-neutral-400">
            <p className="mb-2">No memories yet</p>
            <p className="text-sm">Memories will appear here as you interact with the assistant</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-3">
            {memories.map(memory => (
              <div
                key={memory.id}
                className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-medium ${getTypeBadgeColor(
                          memory.type,
                        )}`}
                      >
                        {memory.type}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-medium ${getSourceBadgeColor(
                          memory.source,
                        )}`}
                      >
                        {memory.source}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-medium ${getImportanceColor(
                          memory.importance,
                        )} border-neutral-600/50`}
                      >
                        Importance: {memory.importance}/10
                      </span>
                    </div>
                    <p className="mb-3 text-neutral-200 whitespace-pre-wrap">{memory.content}</p>
                    {memory.tags && memory.tags.length > 0 && (
                      <div className="mb-2 flex items-center gap-2 flex-wrap">
                        {memory.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-neutral-500">
                      Created: {formatDate(memory.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(memory.id)}
                    disabled={deletingId === memory.id}
                    className="ml-4 rounded bg-red-600/20 px-3 py-1.5 text-sm font-medium text-red-400 border border-red-600/50 hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {deletingId === memory.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryList;
