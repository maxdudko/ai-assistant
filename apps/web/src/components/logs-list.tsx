'use client';

import type { FC } from 'react';
import React, { useState, useEffect } from 'react';

import type { AiLogDto, ConversationMode } from '@/lib/api/types';
import { logsApi } from '@/lib/api/logs';

const LogsList: FC = () => {
  const [logs, setLogs] = useState<AiLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedMode, setSelectedMode] = useState<ConversationMode | ''>('');
  const limit = 20;

  useEffect(() => {
    loadLogs();
  }, [page, selectedMode]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await logsApi.getAll({
        page,
        limit,
        mode: selectedMode || undefined,
      });
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error('Failed to load logs:', err);
      setError('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const truncateText = (text: string, maxLength: number = 200) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const formatActions = (actions: unknown[]) => {
    if (!actions || actions.length === 0) return 'None';
    return `${actions.length} action${actions.length > 1 ? 's' : ''}`;
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Loading logs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI Logs</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="mode-filter" className="text-sm">
            Filter by mode:
          </label>
          <select
            id="mode-filter"
            value={selectedMode}
            onChange={e => {
              setSelectedMode(e.target.value as ConversationMode | '');
              setPage(1);
            }}
            className="rounded border border-neutral-600 bg-neutral-800 px-3 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="MANAGER">Manager</option>
            <option value="REFLECTION">Reflection</option>
            <option value="COMPANION">Companion</option>
            <option value="INFO">Info</option>
          </select>
        </div>
      </div>

      <div className="text-sm text-neutral-400">
        Showing {logs.length} of {total} logs
      </div>

      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-neutral-400">No logs found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {logs.map(log => (
              <div key={log.id} className="rounded-lg border border-neutral-700 bg-neutral-800 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-neutral-700 px-2 py-1 text-xs font-semibold">
                      {log.mode}
                    </span>
                    <span className="text-xs text-neutral-400">{formatDate(log.createdAt)}</span>
                  </div>
                  <span className="text-xs text-neutral-400">
                    {formatActions(log.actions as unknown[])}
                  </span>
                </div>

                <div className="mb-2">
                  <h3 className="mb-1 text-sm font-semibold text-neutral-300">Prompt:</h3>
                  <div className="rounded bg-neutral-900 p-2 text-sm text-neutral-200">
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                      {truncateText(log.prompt)}
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="mb-1 text-sm font-semibold text-neutral-300">Response:</h3>
                  <div className="rounded bg-neutral-900 p-2 text-sm text-neutral-200">
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                      {truncateText(log.response)}
                    </pre>
                  </div>
                </div>

                {log.actions && (log.actions as unknown[]).length > 0 && (
                  <div className="mt-2">
                    <h3 className="mb-1 text-sm font-semibold text-neutral-300">Actions:</h3>
                    <div className="rounded bg-neutral-900 p-2 text-xs">
                      <pre className="whitespace-pre-wrap break-words font-mono text-neutral-300">
                        {JSON.stringify(log.actions, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-neutral-700 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded bg-neutral-700 px-4 py-2 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-neutral-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded bg-neutral-700 px-4 py-2 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default LogsList;
