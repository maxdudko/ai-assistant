'use client';

import React, { useCallback, useEffect, useState } from 'react';

import ManageSubscriptionModal from '@/components/pages/admin/manage-subscription-modal';
import { adminApi } from '@/lib/api/admin';
import type { AdminSubscriptionCatalogDto, AdminSubscriptionListItemDto } from '@/lib/api/types';

export default function AdminSubscriptionsPage() {
  const [catalog, setCatalog] = useState<AdminSubscriptionCatalogDto | null>(null);
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSubscription, setEditingSubscription] =
    useState<AdminSubscriptionListItemDto | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    const [catalogResponse, subscriptionsResponse] = await Promise.all([
      adminApi.getSubscriptionCatalog(),
      adminApi.getSubscriptions(),
    ]);
    setCatalog(catalogResponse);
    setSubscriptions(subscriptionsResponse);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        await loadData();
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
  }, [loadData]);

  return (
    <main className="space-y-6">
      <h2 className="text-xl font-semibold">Subscriptions</h2>

      {catalog && (
        <section className="rounded border border-neutral-800 bg-neutral-900/50 p-4 space-y-3">
          <h3 className="font-medium">Plan catalog</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {catalog.plans.map(plan => (
              <div key={plan.plan} className="rounded border border-neutral-800 p-3 text-sm">
                <p className="font-medium">
                  {plan.label} ({plan.plan})
                </p>
                <p className="text-neutral-400 mt-1">{plan.description}</p>
                <p className="text-neutral-500 mt-2">
                  Features: {plan.features.length > 0 ? plan.features.join(', ') : 'None'}
                </p>
                <p className="text-neutral-500">Digest limit: {plan.limits.maxDigestTopics}</p>
              </div>
            ))}
          </div>
        </section>
      )}

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
                <th className="p-3">Features</th>
                <th className="p-3">Period End</th>
                <th className="p-3">Cancel At Period End</th>
                <th className="p-3">Stripe</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(subscription => (
                <tr key={subscription.id} className="border-t border-neutral-800">
                  <td className="p-3">{subscription.userEmail}</td>
                  <td className="p-3">{subscription.plan}</td>
                  <td className="p-3">{subscription.status}</td>
                  <td className="p-3">
                    {subscription.effectiveFeatures.length > 0
                      ? subscription.effectiveFeatures.join(', ')
                      : '-'}
                  </td>
                  <td className="p-3">
                    {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleString()
                      : '-'}
                  </td>
                  <td className="p-3">{subscription.cancelAtPeriodEnd ? 'Yes' : 'No'}</td>
                  <td className="p-3">{subscription.stripeCustomerId ? 'Linked' : '-'}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setEditingSubscription(subscription)}
                      className="rounded border border-indigo-600 px-2 py-1 text-xs hover:bg-indigo-600/20 cursor-pointer"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingSubscription && (
        <ManageSubscriptionModal
          subscription={editingSubscription}
          onClose={() => setEditingSubscription(null)}
          onSaved={() => {
            void loadData();
          }}
        />
      )}
    </main>
  );
}
