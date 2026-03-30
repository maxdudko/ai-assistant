'use client';

import type { FC } from 'react';
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import TaskModal from './task-modal';

import type { TaskDto, TaskStatus, TaskPriority } from '@/lib/api/types';
import { getTasks, createTask, deleteTask } from '@/lib/api/tasks';
import Container from '@/components/common/container';
import Button from '@/components/common/button';
import { queryKeys } from '@/lib/query-keys';

function formatLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDayKey(value: string | Date): string {
  if (value instanceof Date) {
    return formatLocalDayKey(value);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.split('T')[0];
  }

  return formatLocalDayKey(parsed);
}

function getTaskDayKey(task: TaskDto): string {
  const source = task.day?.date || task.deadline || task.createdAt;
  return toDayKey(source);
}

function formatDayLabel(dayKey: string): string {
  const todayKey = toDayKey(new Date());
  if (dayKey === todayKey) {
    return 'Today';
  }

  const date = new Date(`${dayKey}T12:00:00`);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const TasksList: FC = () => {
  const queryClient = useQueryClient();
  const todayKey = toDayKey(new Date());
  const {
    data: tasks = [],
    isPending: loading,
    isError: loadError,
  } = useQuery({ queryKey: queryKeys.tasks, queryFn: getTasks });
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskDto | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);

  const fetchError = loadError ? 'Failed to load tasks' : null;

  const dayKeys = useMemo(() => {
    const uniqueKeys = new Set<string>(tasks.map(getTaskDayKey));
    uniqueKeys.add(todayKey);
    return Array.from(uniqueKeys).sort((a, b) => b.localeCompare(a));
  }, [tasks, todayKey]);

  const selectedDayIndex = useMemo(
    () => dayKeys.findIndex(dayKey => dayKey === selectedDayKey),
    [dayKeys, selectedDayKey],
  );

  const visibleTasks = useMemo(
    () => tasks.filter(task => getTaskDayKey(task) === selectedDayKey),
    [tasks, selectedDayKey],
  );

  const invalidateTasks = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });

  const handleTaskClick = (task: TaskDto) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const handleCreateNew = async () => {
    if (isCreating) return;

    try {
      setIsCreating(true);
      setError(null);
      const newTask = await createTask({
        name: 'New Task',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        source: 'MANUAL',
      });
      setSelectedTask(newTask);
      setIsModalOpen(true);
      invalidateTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
      setError('Failed to create task');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      if (selectedTask?.id === taskId) {
        setIsModalOpen(false);
        setSelectedTask(null);
      }
      invalidateTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task');
    }
  };

  const goToOlderDay = () => {
    if (selectedDayIndex === -1 || selectedDayIndex >= dayKeys.length - 1) return;
    setSelectedDayKey(dayKeys[selectedDayIndex + 1]);
  };

  const goToNewerDay = () => {
    if (selectedDayIndex <= 0) return;
    setSelectedDayKey(dayKeys[selectedDayIndex - 1]);
  };

  const getStatusBadgeColor = (status: TaskStatus): string => {
    switch (status) {
      case 'TODO':
        return 'bg-[#3fb950]/20 text-[#3fb950] border-[#3fb950]/50';
      case 'IN_PROGRESS':
        return 'bg-[#db6d28]/20 text-[#db6d28] border-[#db6d28]/50';
      case 'DONE':
        return 'bg-[#ab7df8]/20 text-[#ab7df8] border-green-[#ab7df8]/50';
      default:
        return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/50';
    }
  };

  const getPriorityBadgeColor = (priority: TaskPriority): string => {
    switch (priority) {
      case 'LOW':
        return 'bg-green-600/20 text-green-400 border-green-600/50';
      case 'MEDIUM':
        return 'bg-yellow-600/20 text-yellow-400 border-yellow-600/50';
      case 'HIGH':
        return 'bg-red-600/20 text-red-400 border-red-600/50';
      default:
        return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/50';
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'No deadline';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (deadline: string | null): boolean => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-neutral-400">Loading tasks...</div>
      </div>
    );
  }

  if ((fetchError || error) && tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-400">{fetchError || error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <Button
          type="button"
          onClick={handleCreateNew}
          disabled={isCreating}
          content={isCreating ? 'Creating...' : '+ New Task'}
        />
      </div>

      <Container className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goToOlderDay}
            disabled={selectedDayIndex === -1 || selectedDayIndex >= dayKeys.length - 1}
            className="rounded bg-neutral-800 px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Older
          </button>
          <button
            type="button"
            onClick={goToNewerDay}
            disabled={selectedDayIndex <= 0}
            className="rounded bg-neutral-800 px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Newer
          </button>
          <button
            type="button"
            onClick={() => setSelectedDayKey(todayKey)}
            className="rounded bg-indigo-600/80 px-3 py-1 text-sm cursor-pointer"
          >
            Today
          </button>
          <span className="ml-2 text-sm text-neutral-300">
            Showing: {formatDayLabel(selectedDayKey)} ({visibleTasks.length})
          </span>
        </div>
      </Container>

      {error && (
        <div className="mb-4 rounded bg-red-600/20 border border-red-600/50 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {visibleTasks.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-neutral-400">
            <p className="mb-2">No tasks for {formatDayLabel(selectedDayKey).toLowerCase()}</p>
            {selectedDayKey === todayKey ? (
              <button
                onClick={handleCreateNew}
                disabled={isCreating}
                className="text-indigo-400 hover:text-indigo-300 underline disabled:opacity-50 cursor-pointer"
              >
                Create your first task
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedDayKey(todayKey)}
                className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
              >
                Back to today
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {visibleTasks.map(task => (
              <Container key={task.id}>
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="block rounded-lg p-4 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="mb-2 flex items-center gap-2 flex-wrap">
                        <span
                          className={`rounded border px-2 py-0.5 text-xs font-medium ${getStatusBadgeColor(
                            task.status,
                          )}`}
                        >
                          {task.status.replace('_', ' ')}
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 text-xs font-medium ${getPriorityBadgeColor(
                            task.priority,
                          )}`}
                        >
                          {task.priority}
                        </span>
                        {task.source === 'CHAT' && (
                          <span className="rounded border px-2 py-0.5 text-xs font-medium bg-purple-600/20 text-purple-400 border-purple-600/50">
                            From Chat
                          </span>
                        )}
                      </div>
                      <h3 className="mb-1 text-lg font-medium text-neutral-200">{task.name}</h3>
                      {task.description && (
                        <p className="mb-2 text-sm text-neutral-400 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        {task.deadline && (
                          <span
                            className={isOverdue(task.deadline) ? 'text-red-400 font-medium' : ''}
                          >
                            Deadline: {formatDate(task.deadline)}
                            {isOverdue(task.deadline) && ' (Overdue)'}
                          </span>
                        )}
                        <span>Created: {formatDate(task.createdAt)}</span>
                        {task.subtasks && task.subtasks.length > 0 && (
                          <span>{task.subtasks.length} subtask(s)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Container>
            ))}
          </div>
        </div>
      )}

      {isModalOpen && selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={handleCloseModal}
          onDelete={handleDelete}
          onUpdate={invalidateTasks}
        />
      )}
    </div>
  );
};

export default TasksList;
