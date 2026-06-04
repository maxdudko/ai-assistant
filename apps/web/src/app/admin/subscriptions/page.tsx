'use client';

import React, { useEffect, useState } from 'react';

import { adminApi } from '@/lib/api/admin';
import type { AdminSubscriptionListItemDto } from '@/lib/api/types';

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await adminApi.getSubscriptions();
        if (isMounted) {
          setSubscriptions(response);
        }
      } catch {
        if (isMounted) {
          setError('Failed to load subscriptions');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="space-y-4">
      <h2 className="text-xl font-semibold">Subscriptions</h2>
      {loading && <p className="text-neutral-400">Loading subscriptions...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!loading && !error && (
        <div className="overflow-x-auto rounded border border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-900/70 text-left">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Status</th>
                <th className="p-3">Period End</th>
                <th className="p-3">Cancel At Period End</th>
                <th className="p-3">Stripe Customer</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(subscription => (
                <tr key={subscription.id} className="border-t border-neutral-800">
                  <td className="p-3">{subscription.userEmail}</td>
                  <td className="p-3">{subscription.plan}</td>
                  <td className="p-3">{subscription.status}</td>
                  <td className="p-3">
                    {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleString()
                      : '-'}
                  </td>
                  <td className="p-3">{subscription.cancelAtPeriodEnd ? 'Yes' : 'No'}</td>
                  <td className="p-3">{subscription.stripeCustomerId ?? '-'}</td>
                  <td className="p-3">{new Date(subscription.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
