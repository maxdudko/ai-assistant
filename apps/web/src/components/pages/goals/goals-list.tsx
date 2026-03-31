'use client';

import type { FC } from 'react';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import GoalModal from './goal-modal';

import type { GoalDto, GoalType, GoalPriority } from '@/lib/api/types';
import { getGoals, createGoal, deleteGoal } from '@/lib/api/goals';
import Container from '@/components/common/container';
import Button from '@/components/common/button';
import { queryKeys } from '@/lib/query-keys';

const GoalsList: FC = () => {
  const queryClient = useQueryClient();
  const {
    data: goals = [],
    isPending: loading,
    isError: loadError,
  } = useQuery({
    queryKey: queryKeys.goals,
    queryFn: () => getGoals(),
    select: data => data.items,
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<GoalDto | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchError = loadError ? 'Failed to load goals' : null;

  const invalidateGoals = () => void queryClient.invalidateQueries({ queryKey: queryKeys.goals });

  const handleGoalClick = (goal: GoalDto) => {
    setSelectedGoal(goal);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedGoal(null);
  };

  const handleCreateNew = async () => {
    if (isCreating) return;

    try {
      setIsCreating(true);
      setError(null);
      const newGoal = await createGoal({
        name: 'New Goal',
        description: '',
        type: 'SHORT',
        priority: 'MEDIUM',
        isAchieved: false,
        source: 'MANUAL',
      });
      invalidateGoals();
      setSelectedGoal(newGoal);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Failed to create goal:', err);
      setError('Failed to create goal');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (goalId: string) => {
    try {
      await deleteGoal(goalId);
      if (selectedGoal?.id === goalId) {
        setIsModalOpen(false);
        setSelectedGoal(null);
      }
      invalidateGoals();
    } catch (err) {
      console.error('Failed to delete goal:', err);
      setError('Failed to delete goal');
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
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-neutral-400">Loading goals...</div>
      </div>
    );
  }

  if ((fetchError || error) && goals.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-400">{fetchError || error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Goals</h1>
        <Button
          type="button"
          onClick={handleCreateNew}
          disabled={isCreating}
          content={isCreating ? 'Creating...' : '+ New Goal'}
        />
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-600/20 border border-red-600/50 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {goals.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-neutral-400">
            <p className="mb-2">No goals yet</p>
            <button
              onClick={handleCreateNew}
              disabled={isCreating}
              className="text-indigo-400 hover:text-indigo-300 underline disabled:opacity-50"
            >
              Create your first goal
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {goals.map(goal => (
              <Container key={goal.id}>
                <div
                  onClick={() => handleGoalClick(goal)}
                  className="block rounded-lg p-4 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="mb-2 flex items-center gap-2 flex-wrap">
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
                      <h3 className="mb-1 text-lg font-medium text-neutral-200">{goal.name}</h3>
                      {goal.description && (
                        <p className="mb-2 text-sm text-neutral-400 line-clamp-2">
                          {goal.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        <span>Created: {formatDate(goal.createdAt)}</span>
                        {goal.subgoals && goal.subgoals.length > 0 && (
                          <span>{goal.subgoals.length} subgoal(s)</span>
                        )}
                        {goal.tasks && goal.tasks.length > 0 && (
                          <span>{goal.tasks.length} task(s)</span>
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

      {isModalOpen && selectedGoal && (
        <GoalModal
          goal={selectedGoal}
          onClose={handleCloseModal}
          onDelete={handleDelete}
          onUpdate={invalidateGoals}
        />
      )}
    </div>
  );
};

export default GoalsList;
