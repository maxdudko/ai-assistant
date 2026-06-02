'use client';

import type { FC } from 'react';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { generateWeeklyInsight, getLatestWeeklyInsight, listWeeklyInsights } from '@/lib/api/days';
import type { WeeklyInsightDto } from '@/lib/api/types';
import Container from '@/components/common/container';
import Button from '@/components/common/button';
import { queryKeys } from '@/lib/query-keys';

function formatDateRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  const fmt = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const yearSuffix = start.getFullYear() === end.getFullYear() ? `, ${end.getFullYear()}` : '';
  return `${fmt(start)} – ${fmt(end)}${yearSuffix}`;
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 8
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
      : score >= 5
        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
        : 'bg-amber-500/15 text-amber-300 border-amber-500/40';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${tone}`}
    >
      Score {score}/10
    </span>
  );
}

function PatternChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-neutral-800 text-neutral-300 border border-neutral-700">
      {tag}
    </span>
  );
}

function WeeklyInsightCard({ insight }: { insight: WeeklyInsightDto }) {
  const completionPct = Math.round(insight.completionRate * 100);
  return (
    <article className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-neutral-100">
            Week {insight.isoWeek}, {insight.isoYear}
          </h3>
          <p className="text-sm text-neutral-400">
            {formatDateRange(insight.weekStart, insight.weekEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBadge score={insight.score} />
          {insight.source === 'MANUAL' && <span className="text-xs text-neutral-500">Manual</span>}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-neutral-800/40 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Completion</div>
          <div className="mt-1 text-lg font-semibold text-neutral-100">{completionPct}%</div>
          <div className="text-xs text-neutral-500">
            {insight.completedTasks}/{insight.totalTasks} tasks
          </div>
        </div>
        <div className="rounded-lg bg-neutral-800/40 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Tasks</div>
          <div className="mt-1 text-lg font-semibold text-neutral-100">{insight.totalTasks}</div>
          <div className="text-xs text-neutral-500">planned</div>
        </div>
        <div className="rounded-lg bg-neutral-800/40 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Reschedules</div>
          <div className="mt-1 text-lg font-semibold text-neutral-100">{insight.reschedules}</div>
          <div className="text-xs text-neutral-500">moved forward</div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-neutral-300">Reflection</h4>
        <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-200">
          {insight.narrative}
        </p>
      </div>

      {insight.focusSuggestion && (
        <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-indigo-300/80">
            Focus for next week
          </div>
          <p className="mt-1 text-sm text-indigo-100">{insight.focusSuggestion}</p>
        </div>
      )}

      {insight.topPatterns.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Patterns</span>
          {insight.topPatterns.map(tag => (
            <PatternChip key={tag} tag={tag} />
          ))}
        </div>
      )}
    </article>
  );
}

const InsightsView: FC = () => {
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const latestQuery = useQuery({
    queryKey: queryKeys.weeklyInsightLatest,
    queryFn: getLatestWeeklyInsight,
  });

  const listQuery = useQuery({
    queryKey: queryKeys.weeklyInsightList,
    queryFn: () => listWeeklyInsights({ limit: 10 }),
  });

  const generateMutation = useMutation({
    mutationFn: generateWeeklyInsight,
    onSuccess: result => {
      if (result) {
        setActionMessage('Generated a fresh weekly reflection.');
      } else {
        setActionMessage('No activity recorded for this week yet — nothing to summarize.');
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.weeklyInsightLatest });
      queryClient.invalidateQueries({ queryKey: queryKeys.weeklyInsightList });
    },
    onError: error => {
      setActionMessage(error instanceof Error ? error.message : 'Failed to generate insight.');
    },
  });

  const latest = latestQuery.data ?? null;
  const history = (listQuery.data?.items ?? []).filter(item => !latest || item.id !== latest.id);

  return (
    <main className="flex-1 overflow-y-auto">
      <Container className="max-w-4xl w-full mx-auto p-4 md:p-8 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-neutral-100">
              Insight & Reflection
            </h1>
            <p className="text-sm text-neutral-400">
              Weekly summaries and recurring patterns Mira has noticed about you.
            </p>
          </div>
          <Button
            type="button"
            content={generateMutation.isPending ? 'Generating…' : 'Generate now'}
            onClick={() => {
              setActionMessage(null);
              generateMutation.mutate();
            }}
            disabled={generateMutation.isPending}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          />
        </header>

        {actionMessage && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-300">
            {actionMessage}
          </div>
        )}

        {(latestQuery.isPending || listQuery.isPending) && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6 text-sm text-neutral-400">
            Loading reflections…
          </div>
        )}

        {!latestQuery.isPending && !latest && history.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-900/30 p-6 text-sm text-neutral-400">
            No weekly reflection yet. As you plan and complete tasks during the week, Mira will
            assemble a personal summary every Sunday — or you can generate one manually any time.
          </div>
        )}

        {latest && (
          <section className="space-y-3">
            <h2 className="text-sm uppercase tracking-wide text-neutral-500">Latest week</h2>
            <WeeklyInsightCard insight={latest} />
          </section>
        )}

        {history.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm uppercase tracking-wide text-neutral-500">Earlier weeks</h2>
            <div className="space-y-4">
              {history.map(insight => (
                <WeeklyInsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </main>
  );
};

export default InsightsView;
