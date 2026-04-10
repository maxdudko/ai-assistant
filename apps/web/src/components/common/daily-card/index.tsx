'use client';

import { useQuery } from '@tanstack/react-query';

import type { TaskDto } from '@/lib/api/types';
import { getTasks } from '@/lib/api/tasks';
import { queryKeys } from '@/lib/query-keys';
import Container from '@/components/common/container';

type DailyCardData = {
  date: string;
  score?: number;
  insight?: string;

  priorities: TaskDto[];
  totalEstimated?: number;
  available?: number;

  completed: number;
  total: number;
};

function DailyCard() {
  const {
    data: tasks = [],
    isPending: loading,
    isError: tasksError,
    error: tasksErrorObj,
  } = useQuery({
    queryKey: queryKeys.tasks,
    queryFn: () => getTasks(),
    select: data => data.items,
  });

  const briefing = {
    date: new Date().toISOString(),
    priorities: tasks.filter(t => t.priority === 'HIGH' && t.status !== 'DONE'),
    totalEstimated: tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0),
    available: 8, // Assume an 8-hour workday for simplicity
    insight: tasks.some(t => t.deadline && new Date(t.deadline) < new Date())
      ? 'You have tasks with upcoming deadlines!'
      : undefined,
  };

  const completed = tasks.filter(t => t.status === 'DONE').length;
  const total = tasks.length;

  return (
    <Container className="p-4 mb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Today</h2>
        <span className="text-sm text-neutral-400">
          {completed}/{total} done
        </span>
      </div>

      {/* Progress */}
      <div className="mt-3 w-full bg-neutral-800 rounded-full h-2">
        <div
          className="bg-green-500 h-2 rounded-full"
          style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
        />
      </div>

      {/* Priorities */}
      <div className="mt-4">
        <p className="text-sm text-neutral-400">Top priorities</p>
        {briefing?.priorities?.length ? (
          <ul className="mt-2 space-y-1">
            {briefing.priorities.map(p => (
              <li key={p.id} className="text-sm">
                • {p.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500 mt-1">No priorities yet</p>
        )}
      </div>

      {/* Load (Task Intelligence) */}
      {briefing?.totalEstimated && briefing?.available && (
        <div className="mt-4 text-sm">
          <span className="text-neutral-400">Load: </span>
          <span>
            {briefing.totalEstimated}h / {briefing.available}h
          </span>
          {briefing.totalEstimated > briefing.available && (
            <span className="ml-2 text-yellow-400">⚠ Overloaded</span>
          )}
        </div>
      )}

      {/* Insight */}
      {briefing?.insight && (
        <div className="mt-4 text-sm text-neutral-300">💡 {briefing.insight}</div>
      )}
    </Container>
  );
}

export default DailyCard;
