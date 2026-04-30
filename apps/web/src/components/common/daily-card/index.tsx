'use client';

import { useQuery } from '@tanstack/react-query';

import { getDayIntelligence } from '@/lib/api/days';
import { queryKeys } from '@/lib/query-keys';
import Container from '@/components/common/container';

function DailyCard() {
  const {
    data: intelligence,
    isPending: loading,
    isError,
  } = useQuery({
    queryKey: queryKeys.dayIntelligence,
    queryFn: getDayIntelligence,
  });

  if (loading) {
    return (
      <Container className="p-4 mb-2">
        <div className="text-neutral-400 text-sm">Loading daily intelligence...</div>
      </Container>
    );
  }

  if (isError || !intelligence) {
    return (
      <Container className="p-4 mb-2">
        <div className="text-red-400 text-sm">Unable to load daily intelligence.</div>
      </Container>
    );
  }

  return (
    <Container className="p-4 mb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Today ({intelligence.phase})</h2>
        <span className="text-sm text-neutral-400">Daily OS intelligence</span>
      </div>

      {/* Priorities */}
      <div className="mt-4">
        <p className="text-sm text-neutral-400">Top priorities</p>
        {intelligence.topTasks.length ? (
          <ul className="mt-2 space-y-1">
            {intelligence.topTasks.map(task => (
              <li key={task.id} className="text-sm">
                • {task.name} (~{task.estimatedMinutes}m) - {task.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500 mt-1">No priorities yet</p>
        )}
      </div>

      {/* Load (Task Intelligence) */}
      <div className="mt-4 text-sm">
        <span className="text-neutral-400">Load: </span>
        <span>
          {intelligence.load.plannedMinutes}m / {intelligence.load.availableMinutes}m
        </span>
        {intelligence.load.overload && <span className="ml-2 text-yellow-400">Overloaded</span>}
      </div>

      {intelligence.insights.length > 0 && (
        <div className="mt-4 text-sm text-neutral-300">
          <p className="text-neutral-400">Insights</p>
          <ul className="mt-1 space-y-1">
            {intelligence.insights.map((insight, index) => (
              <li key={`${insight}-${index}`}>- {insight}</li>
            ))}
          </ul>
        </div>
      )}

      {intelligence.reasoning.length > 0 && (
        <div className="mt-4 text-sm text-neutral-300">
          <p className="text-neutral-400">Reasoning</p>
          <ul className="mt-1 space-y-1">
            {intelligence.reasoning.map((reason, index) => (
              <li key={`${reason}-${index}`}>- {reason}</li>
            ))}
          </ul>
        </div>
      )}

      {intelligence.suggestedActions.length > 0 && (
        <div className="mt-4 text-sm text-neutral-300">
          <p className="text-neutral-400">Suggested actions</p>
          <ul className="mt-1 space-y-1">
            {intelligence.suggestedActions.slice(0, 3).map(action => (
              <li key={action.id}>- {action.type}</li>
            ))}
          </ul>
        </div>
      )}
    </Container>
  );
}

export default DailyCard;
