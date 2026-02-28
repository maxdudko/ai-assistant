'use client';

import type { FC } from 'react';
import React, { useState, useEffect } from 'react';

import type { TaskDto, TaskStatus, TaskPriority } from '@/lib/api/types';
import { updateTask } from '@/lib/api/tasks';
import Container from '@/components/common/container';

interface TaskModalProps {
  task: TaskDto;
  onClose: () => void;
  onDelete: (taskId: string) => void;
  onUpdate: () => void;
}

const TaskModal: FC<TaskModalProps> = ({ task, onClose, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: task.name,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    deadline: task.deadline ? task.deadline.split('T')[0] : '',
  });

  useEffect(() => {
    setFormData({
      name: task.name,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      deadline: task.deadline ? task.deadline.split('T')[0] : '',
    });
  }, [task]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateTask(task.id, {
        name: formData.name,
        description: formData.description || undefined,
        status: formData.status,
        priority: formData.priority,
        deadline: formData.deadline || undefined,
      });
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      console.error('Failed to update task:', err);
      alert('Failed to update task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      setIsDeleting(true);
      await onDelete(task.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete task:', err);
      alert('Failed to delete task');
      setIsDeleting(false);
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
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Container className="w-full max-w-2xl rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Task Details</h2>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="rounded bg-neutral-700 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-600 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {isEditing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1" htmlFor="name">
                  Name
                </label>
                <input
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-neutral-300 mb-1"
                  htmlFor="description"
                >
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium text-neutral-300 mb-1"
                    htmlFor="status"
                  >
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={e =>
                      setFormData({ ...formData, status: e.target.value as TaskStatus })
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="TODO">Todo</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-neutral-300 mb-1"
                    htmlFor="priority"
                  >
                    Priority
                  </label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={e =>
                      setFormData({ ...formData, priority: e.target.value as TaskPriority })
                    }
                    className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-neutral-300 mb-1"
                  htmlFor="deadline"
                >
                  Deadline
                </label>
                <input
                  name="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: task.name,
                      description: task.description || '',
                      status: task.status,
                      priority: task.priority,
                      deadline: task.deadline ? task.deadline.split('T')[0] : '',
                    });
                  }}
                  className="rounded bg-neutral-700 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !formData.name.trim()}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
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

              <div>
                <h3 className="text-xl font-semibold text-neutral-200 mb-2">{task.name}</h3>
                {task.description && (
                  <p className="text-neutral-400 whitespace-pre-wrap">{task.description}</p>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-neutral-500">Deadline: </span>
                  <span className="text-neutral-300">{formatDate(task.deadline)}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Created: </span>
                  <span className="text-neutral-300">{formatDate(task.createdAt)}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Updated: </span>
                  <span className="text-neutral-300">{formatDate(task.updatedAt)}</span>
                </div>
                {task.subtasks && task.subtasks.length > 0 && (
                  <div>
                    <span className="text-neutral-500">Subtasks: </span>
                    <span className="text-neutral-300">{task.subtasks.length}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Container>
    </div>
  );
};

export default TaskModal;
