'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventInput } from '@fullcalendar/core';

import { getTasks, deleteTask, getTask } from '@/lib/api/tasks';
import { getMorningBriefing } from '@/lib/api/days';
import { getPendingActions, confirmAction, dismissAction } from '@/lib/api/actions';
import type { TaskDto } from '@/lib/api/types';
import Container from '@/components/common/container';
import { queryKeys } from '@/lib/query-keys';
import DailyCard from '@/components/common/daily-card';

const Chat = dynamic(() => import('@/components/pages/chat/chat'), {
  loading: () => (
    <div className="flex h-full min-h-[200px] items-center justify-center text-neutral-400">
      Loading chat…
    </div>
  ),
});

const MeDashboardCalendar = dynamic(() => import('@/components/pages/me/me-dashboard-calendar'), {
  loading: () => <div className="py-12 text-center text-neutral-400">Loading calendar…</div>,
});

const TaskModal = dynamic(() => import('@/components/pages/tasks/task-modal'));

function getEventColor(task: TaskDto): string {
  if (task.status === 'DONE') {
    return '#6b7280'; // gray
  }

  switch (task.priority) {
    case 'HIGH':
      return '#ef4444'; // red
    case 'MEDIUM':
      return '#f59e0b'; // amber
    case 'LOW':
      return '#10b981'; // green
    default:
      return '#3b82f6'; // blue
  }
}

function transformTasksToEvents(tasks: TaskDto[]): EventInput[] {
  return tasks
    .filter(task => task.deadline || task.createdAt) // Only show tasks with a date
    .map(task => {
      const date = task.deadline || task.createdAt;
      const isDeadline = !!task.deadline;

      return {
        id: task.id,
        title: task.name,
        start: date,
        allDay: !isDeadline, // If it's a deadline, show as all-day. If created date, also all-day
        backgroundColor: getEventColor(task),
        borderColor: getEventColor(task),
        extendedProps: {
          description: task.description,
          status: task.status,
          priority: task.priority,
          isDeadline,
        },
      };
    });
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<TaskDto | null>(null);

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

  const { data: morningBriefing, isPending: briefingPending } = useQuery({
    queryKey: queryKeys.morningBriefing,
    queryFn: getMorningBriefing,
    retry: false,
  });
  const { data: pendingActions } = useQuery({
    queryKey: queryKeys.pendingActions('dashboard'),
    queryFn: () => getPendingActions({ dayId: morningBriefing?.day.id, limit: 10 }),
    enabled: Boolean(morningBriefing?.day.id),
  });

  const events = useMemo(() => transformTasksToEvents(tasks), [tasks]);

  const error = tasksError
    ? tasksErrorObj instanceof Error
      ? tasksErrorObj.message
      : 'Failed to load tasks'
    : null;

  const refreshDashboard = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    void queryClient.invalidateQueries({ queryKey: queryKeys.morningBriefing });
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg">Loading tasks...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg text-red-500">Error: {error}</p>
      </main>
    );
  }

  return (
    <div className="xl:flex xl:h-screen xl:overflow-hidden">
      <div className="flex-1 xl:p-2 xl:overflow-hidden xl:flex xl:flex-col xl:max-h-[calc(100vh-100px)]">
        <Chat />
      </div>
      <div className="flex-1 rounded-lg shadow-lg xl:p-2 xl:h-full xl:overflow-y-auto">
        <Container className="hidden lg:block p-4 min-w-0 overflow-x-auto">
          <DailyCard />
          <MeDashboardCalendar events={events} tasks={tasks} onTaskSelect={setSelectedTask} />
        </Container>
        <Container className="p-4 my-4">
          <div className="flex items-center justify-between gap-4">
            <b className="text-2xl">Morning briefing</b>
            <button
              type="button"
              onClick={refreshDashboard}
              className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700 cursor-pointer"
            >
              Refresh
            </button>
          </div>
          {briefingPending ? (
            <p className="mt-4 text-sm text-neutral-500">Loading briefing…</p>
          ) : morningBriefing ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm text-neutral-400">Daily tasks</p>
                {morningBriefing.tasks.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {morningBriefing.tasks.map(task => (
                      <li key={task.id} className="text-sm">
                        - {task.name} ({task.status}, {task.priority})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-neutral-500">No tasks planned for today yet.</p>
                )}
              </div>

              <div>
                <p className="text-sm text-neutral-400">Top priorities (1-2)</p>
                {morningBriefing.priorities.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {morningBriefing.priorities.map(priority => (
                      <li key={priority.id} className="text-sm">
                        - {priority.name} ({priority.priority}) - {priority.reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-neutral-500">
                    No active priorities right now. You can add a task to start planning.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-neutral-500">
              Morning briefing is unavailable right now.
            </p>
          )}
        </Container>
        <Container className="p-4 my-4">
          <b className="text-2xl">Pending actions</b>
          {pendingActions && pendingActions.items.length > 0 ? (
            <div className="mt-4 space-y-2">
              {pendingActions.items.map(action => (
                <div key={action.id} className="rounded border border-neutral-700 p-3">
                  <div className="text-sm text-neutral-200">
                    {action.type} ({Math.round(action.confidence * 100)}% confidence)
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
                      onClick={async () => {
                        await confirmAction({ actionId: action.id });
                        await queryClient.invalidateQueries({
                          queryKey: queryKeys.pendingActions('dashboard'),
                        });
                        await queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="rounded border border-neutral-500/40 bg-neutral-500/10 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-500/20"
                      onClick={async () => {
                        await dismissAction(action.id);
                        await queryClient.invalidateQueries({
                          queryKey: queryKeys.pendingActions('dashboard'),
                        });
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-neutral-500">No pending actions.</p>
          )}
        </Container>
        <Container className="p-4 my-4">
          <b className="text-2xl p-4">Advices:</b>
          <ul>
            {/*  Generate something like advise from AI guru className="ml-4 list-disc*/}
            <li className="ml-4 list-disc">
              Prioritize tasks based on their impact and urgency, not just deadlines. Focus on
              high-impact tasks that align with your long-term goals, even if they don&#39;t have
              immediate deadlines.
            </li>
            <li className="ml-4 list-disc">
              Use time blocking to dedicate focused periods for deep work on important tasks,
              minimizing distractions and maximizing productivity.
            </li>
            <li className="ml-4 list-disc">
              Don&#39;t forget to take regular breaks to recharge your energy and maintain mental
              clarity. Short breaks can boost creativity and prevent burnout, helping you stay
              productive in the long run.
            </li>
            <li className="ml-4 list-disc">
              Also don&#39;t forget about your personal life and family, they are important for your
              well-being and happiness, and they can also provide support and motivation for your
              work.
            </li>
          </ul>
        </Container>
        <Container className="mt-6 p-4">
          <b className="text-2xl">Performance charts:</b>
          <Container className="mt-4 p-4">
            <h3 className="text-lg font-semibold mb-4">Task Status Distribution</h3>
            <div className="space-y-4">
              {(() => {
                const statusCounts = tasks.reduce(
                  (acc, task) => {
                    acc[task.status] = (acc[task.status] || 0) + 1;
                    return acc;
                  },
                  {} as Record<string, number>,
                );
                const total = tasks.length;
                const statuses: Array<{ status: string; label: string; color: string }> = [
                  { status: 'TODO', label: 'To Do', color: 'bg-[#3fb950]' },
                  { status: 'IN_PROGRESS', label: 'In Progress', color: 'bg-[#db6d28]' },
                  { status: 'DONE', label: 'Done', color: 'bg-[#ab7df8]' },
                ];

                return statuses.map(({ status, label, color }) => {
                  const count = statusCounts[status] || 0;
                  const percentage = total > 0 ? (count / total) * 100 : 0;

                  return (
                    <div key={status} className="w-full">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                        <span className="text-sm text-gray-600">
                          {count} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                        <div
                          className={`${color} h-6 rounded-full transition-all duration-300 flex items-center justify-end pr-2`}
                          style={{ width: `${percentage}%` }}
                        >
                          {percentage > 10 && (
                            <span className="text-white text-xs font-medium">{count}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            {tasks.length === 0 && (
              <p className="text-gray-500 text-sm mt-4">No tasks available to display.</p>
            )}
          </Container>
        </Container>
      </div>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onDelete={async (taskId: string) => {
            await deleteTask(taskId);
            await queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
          }}
          onUpdate={async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
            try {
              const updatedTask = await getTask(selectedTask.id);
              setSelectedTask(updatedTask);
            } catch (err) {
              console.error('Failed to refresh task:', err);
              setSelectedTask(null);
            }
          }}
        />
      )}
    </div>
  );
}
