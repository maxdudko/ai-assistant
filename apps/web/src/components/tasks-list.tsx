'use client';

import type { FC } from 'react';
import React, { useState, useEffect } from 'react';

import type { TaskDto, TaskStatus, TaskPriority } from '@/lib/api/types';
import { getTasks, createTask, deleteTask } from '@/lib/api/tasks';
import TaskModal from './task-modal';

const TasksList: FC = () => {
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskDto | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task: TaskDto) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
    loadTasks(); // Refresh tasks after modal closes
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
      await loadTasks();
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
      await loadTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task');
    }
  };

  const getStatusBadgeColor = (status: TaskStatus): string => {
    switch (status) {
      case 'TODO':
        return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/50';
      case 'IN_PROGRESS':
        return 'bg-blue-600/20 text-blue-400 border-blue-600/50';
      case 'DONE':
        return 'bg-green-600/20 text-green-400 border-green-600/50';
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
      year: date.getFullYear(),
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

  if (error && tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <button
          onClick={handleCreateNew}
          disabled={isCreating}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isCreating ? 'Creating...' : '+ New Task'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-600/20 border border-red-600/50 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-neutral-400">
            <p className="mb-2">No tasks yet</p>
            <button
              onClick={handleCreateNew}
              disabled={isCreating}
              className="text-indigo-400 hover:text-indigo-300 underline disabled:opacity-50"
            >
              Create your first task
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {tasks.map(task => (
              <div
                key={task.id}
                onClick={() => handleTaskClick(task)}
                className="block rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800 cursor-pointer"
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
            ))}
          </div>
        </div>
      )}

      {isModalOpen && selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={handleCloseModal}
          onDelete={handleDelete}
          onUpdate={loadTasks}
        />
      )}
    </div>
  );
};

export default TasksList;
