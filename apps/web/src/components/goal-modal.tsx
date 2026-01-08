'use client';

import type { FC } from 'react';
import React, { useState, useEffect } from 'react';

import type { GoalDto, GoalType, GoalPriority } from '@/lib/api/types';
import { updateGoal } from '@/lib/api/goals';

interface GoalModalProps {
  goal: GoalDto;
  onClose: () => void;
  onDelete: (goalId: string) => void;
  onUpdate: () => void;
}

const GoalModal: FC<GoalModalProps> = ({ goal, onClose, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: goal.name,
    description: goal.description || '',
    type: goal.type,
    priority: goal.priority,
    isAchieved: goal.isAchieved,
  });

  useEffect(() => {
    setFormData({
      name: goal.name,
      description: goal.description || '',
      type: goal.type,
      priority: goal.priority,
      isAchieved: goal.isAchieved,
    });
  }, [goal]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateGoal(goal.id, {
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
        priority: formData.priority,
        isAchieved: formData.isAchieved,
      });
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      console.error('Failed to update goal:', err);
      alert('Failed to update goal');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this goal?')) {
      return;
    }

    try {
      setIsDeleting(true);
      await onDelete(goal.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete goal:', err);
      alert('Failed to delete goal');
      setIsDeleting(false);
    }
  };

  const getTypeBadgeColor = (type: GoalType): string => {
    switch (type) {
      case 'SHORT':
        return 'bg-blue-600/20 text-blue-400 border-blue-600/50';
      case 'MIDDLE':
        return 'bg-purple-600/20 text-purple-400 border-purple-600/50';
      case 'LONG':
        return 'bg-indigo-600/20 text-indigo-400 border-indigo-600/50';
      default:
        return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/50';
    }
  };

  const getPriorityBadgeColor = (priority: GoalPriority): string => {
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
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Goal Details</h2>
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
                  value={formData.description}
                  name="description"
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1" htmlFor="type">
                    Type
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as GoalType })}
                    className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="SHORT">Short</option>
                    <option value="MIDDLE">Middle</option>
                    <option value="LONG">Long</option>
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
                      setFormData({ ...formData, priority: e.target.value as GoalPriority })
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
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                  <input
                    type="checkbox"
                    checked={formData.isAchieved}
                    onChange={e => setFormData({ ...formData, isAchieved: e.target.checked })}
                    className="rounded"
                  />
                  Achieved
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: goal.name,
                      description: goal.description || '',
                      type: goal.type,
                      priority: goal.priority,
                      isAchieved: goal.isAchieved,
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
                  className={`rounded border px-2 py-0.5 text-xs font-medium ${getTypeBadgeColor(
                    goal.type,
                  )}`}
                >
                  {goal.type}
                </span>
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-medium ${getPriorityBadgeColor(
                    goal.priority,
                  )}`}
                >
                  {goal.priority}
                </span>
                {goal.isAchieved && (
                  <span className="rounded border px-2 py-0.5 text-xs font-medium bg-green-600/20 text-green-400 border-green-600/50">
                    Achieved ✓
                  </span>
                )}
                {goal.source === 'CHAT' && (
                  <span className="rounded border px-2 py-0.5 text-xs font-medium bg-purple-600/20 text-purple-400 border-purple-600/50">
                    From Chat
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-xl font-semibold text-neutral-200 mb-2">{goal.name}</h3>
                {goal.description && (
                  <p className="text-neutral-400 whitespace-pre-wrap">{goal.description}</p>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-neutral-500">Created: </span>
                  <span className="text-neutral-300">{formatDate(goal.createdAt)}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Updated: </span>
                  <span className="text-neutral-300">{formatDate(goal.updatedAt)}</span>
                </div>
                {goal.subgoals && goal.subgoals.length > 0 && (
                  <div>
                    <span className="text-neutral-500">Subgoals: </span>
                    <span className="text-neutral-300">{goal.subgoals.length}</span>
                  </div>
                )}
                {goal.tasks && goal.tasks.length > 0 && (
                  <div>
                    <span className="text-neutral-500">Tasks: </span>
                    <span className="text-neutral-300">{goal.tasks.length}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalModal;
