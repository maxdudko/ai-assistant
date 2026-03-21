'use client';

import type { FC } from 'react';
import React, { useState, useEffect } from 'react';

import type { DigestSubscriptionDto } from '@/lib/api/digest';
import { subscribeDigest, unsubscribeDigest } from '@/lib/api/digest';
import Container from '@/components/common/container';

interface DigestSubscriptionModalProps {
  subscription: DigestSubscriptionDto | null;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: (subscription: DigestSubscriptionDto) => void;
}

const DigestSubscriptionModal: FC<DigestSubscriptionModalProps> = ({
  subscription,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    topic: subscription?.topic || '',
    frequency: subscription?.frequency || 'daily',
  });

  useEffect(() => {
    setFormData({
      topic: subscription?.topic || '',
      frequency: subscription?.frequency || 'daily',
    });
    setIsEditing(!subscription);
  }, [subscription]);

  const handleSave = async () => {
    if (!formData.topic.trim()) {
      alert('Topic is required');
      return;
    }

    try {
      setIsSaving(true);
      await subscribeDigest({
        topic: formData.topic.trim(),
        frequency: formData.frequency === 'daily' ? 'daily' : undefined,
      });
      setIsEditing(false);
      onUpdate();
      if (!subscription) {
        onClose();
      }
    } catch (err) {
      console.error('Failed to save subscription:', err);
      alert('Failed to save subscription');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!subscription) return;

    if (!confirm(`Are you sure you want to unsubscribe from "${subscription.topic}"?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await unsubscribeDigest({ topic: subscription.topic });
      onDelete(subscription);
      onClose();
    } catch (err) {
      console.error('Failed to delete subscription:', err);
      alert('Failed to delete subscription');
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getFrequencyBadgeColor = (frequency: string): string => {
    switch (frequency.toLowerCase()) {
      case 'daily':
        return 'bg-blue-600/20 text-blue-400 border-blue-600/50';
      default:
        return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Container className="w-full max-w-2xl rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            {subscription ? 'Digest Subscription' : 'New Digest Subscription'}
          </h2>
          <div className="flex items-center gap-2">
            {subscription && !isEditing && (
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
                  {isDeleting ? 'Unsubscribing...' : 'Unsubscribe'}
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
          {isEditing || !subscription ? (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1" htmlFor="topic">
                  Topic *
                </label>
                <input
                  name="topic"
                  type="text"
                  value={formData.topic}
                  onChange={e => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="e.g., Crypto, AI, Technology"
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-200 focus:border-indigo-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  The topic you want to receive daily information digests about
                </p>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-neutral-300 mb-1"
                  htmlFor="frequency"
                >
                  Frequency
                </label>
                <select
                  name="frequency"
                  value={formData.frequency}
                  onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-200 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="daily">Daily</option>
                </select>
                <p className="mt-1 text-xs text-neutral-500">
                  How often you want to receive digests (currently only daily is supported)
                </p>
              </div>

              <div className="flex justify-end gap-2">
                {subscription && (
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        topic: subscription.topic,
                        frequency: subscription.frequency,
                      });
                    }}
                    className="rounded bg-neutral-700 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={isSaving || !formData.topic.trim()}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSaving ? 'Saving...' : subscription ? 'Save Changes' : 'Create Subscription'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-medium ${getFrequencyBadgeColor(
                    subscription.frequency,
                  )}`}
                >
                  {subscription.frequency.charAt(0).toUpperCase() + subscription.frequency.slice(1)}
                </span>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-neutral-200 mb-2">
                  {subscription.topic}
                </h3>
                <p className="text-neutral-400">
                  You will receive daily information digests about this topic.
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-neutral-500">Frequency: </span>
                  <span className="text-neutral-300 capitalize">{subscription.frequency}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Created: </span>
                  <span className="text-neutral-300">{formatDate(subscription.createdAt)}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Updated: </span>
                  <span className="text-neutral-300">{formatDate(subscription.updatedAt)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </Container>
    </div>
  );
};

export default DigestSubscriptionModal;
