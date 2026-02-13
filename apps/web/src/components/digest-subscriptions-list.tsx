'use client';

import type { FC } from 'react';
import React, { useState, useEffect } from 'react';

import DigestSubscriptionModal from './digest-subscription-modal';

import type { DigestSubscriptionDto } from '@/lib/api/digest';
import { getDigestSubscriptions, unsubscribeDigest } from '@/lib/api/digest';

const DigestSubscriptionsList: FC = () => {
  const [subscriptions, setSubscriptions] = useState<DigestSubscriptionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<DigestSubscriptionDto | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDigestSubscriptions();
      setSubscriptions(data);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
      setError('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionClick = (subscription: DigestSubscriptionDto) => {
    setSelectedSubscription(subscription);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSubscription(null);
    loadSubscriptions(); // Refresh subscriptions after modal closes
  };

  const handleCreateNew = () => {
    setSelectedSubscription(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (subscription: DigestSubscriptionDto) => {
    try {
      await unsubscribeDigest({ topic: subscription.topic });
      if (selectedSubscription?.id === subscription.id) {
        setIsModalOpen(false);
        setSelectedSubscription(null);
      }
      await loadSubscriptions();
    } catch (err) {
      console.error('Failed to delete subscription:', err);
      setError('Failed to delete subscription');
    }
  };

  const getFrequencyBadgeColor = (frequency: string): string => {
    switch (frequency.toLowerCase()) {
      case 'daily':
        return 'bg-blue-600/20 text-blue-400 border-blue-600/50';
      default:
        return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/50';
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-neutral-400">Loading subscriptions...</div>
      </div>
    );
  }

  if (error && subscriptions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Info Digest Subscriptions</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Manage your daily information digest subscriptions
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          disabled={isCreating}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isCreating ? 'Creating...' : '+ New Subscription'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-600/20 border border-red-600/50 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {subscriptions.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-neutral-400">
            <p className="mb-2">No subscriptions yet</p>
            <p className="mb-4 text-sm">
              Subscribe to topics to receive daily information digests in INFO mode
            </p>
            <button
              onClick={handleCreateNew}
              disabled={isCreating}
              className="text-indigo-400 hover:text-indigo-300 underline disabled:opacity-50"
            >
              Create your first subscription
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {subscriptions.map(subscription => (
              <div
                key={subscription.id}
                onClick={() => handleSubscriptionClick(subscription)}
                className="block rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-medium ${getFrequencyBadgeColor(
                          subscription.frequency,
                        )}`}
                      >
                        {subscription.frequency.charAt(0).toUpperCase() +
                          subscription.frequency.slice(1)}
                      </span>
                    </div>
                    <h3 className="mb-1 text-lg font-medium text-neutral-200">
                      {subscription.topic}
                    </h3>
                    <p className="mb-2 text-sm text-neutral-400">
                      Daily information digests about this topic
                    </p>
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      <span>Created: {formatDate(subscription.createdAt)}</span>
                      <span>Updated: {formatDate(subscription.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isModalOpen && (
        <DigestSubscriptionModal
          subscription={selectedSubscription}
          onClose={handleCloseModal}
          onUpdate={loadSubscriptions}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default DigestSubscriptionsList;
