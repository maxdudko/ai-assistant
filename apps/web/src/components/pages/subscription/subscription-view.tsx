'use client';

import type { FC } from 'react';
import React, { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import {
  createBillingPortalSession,
  createCheckoutSession,
  getSubscriptionHistory,
  getSubscriptionMe,
} from '@/lib/api/subscriptions';
import type {
  Feature,
  PaymentRecordDto,
  PlanCatalogEntryDto,
  SubscriptionEventDto,
  SubscriptionPlan,
} from '@/lib/api/types';
import Container from '@/components/common/container';
import Button from '@/components/common/button';
import { queryKeys } from '@/lib/query-keys';

const FEATURE_LABELS: Record<Feature, string> = {
  ADVANCED_INSIGHTS: 'Advanced weekly insights',
  TRUTHLENS: 'TruthLens comparative digests',
  CROSS_WEEK_ANALYSIS: 'Cross-week trend analysis',
};

function PlanBadge({ plan }: { plan: SubscriptionPlan }) {
  const tone =
    plan === 'PRO'
      ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
      : 'bg-neutral-800 text-neutral-300 border-neutral-700';
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${tone}`}>
      {plan}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'ACTIVE' || status === 'TRIALING' || status === 'PAID'
      ? 'text-emerald-300'
      : status === 'PAST_DUE' || status === 'FAILED'
        ? 'text-amber-300'
        : 'text-neutral-400';
  return <span className={`text-sm ${tone}`}>{status.replace('_', ' ')}</span>;
}

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function PaymentHistoryTable({ payments }: { payments: PaymentRecordDto[] }) {
  if (payments.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No payments yet. Invoices appear here after your first Pro checkout.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-left text-neutral-500">
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">Description</th>
            <th className="py-2 pr-4 font-medium">Amount</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 font-medium">Invoice</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(payment => (
            <tr key={payment.id} className="border-b border-neutral-800/60 text-neutral-300">
              <td className="py-3 pr-4 whitespace-nowrap">
                {formatDateTime(payment.paidAt ?? payment.createdAt)}
              </td>
              <td className="py-3 pr-4">{payment.description ?? 'Subscription payment'}</td>
              <td className="py-3 pr-4 whitespace-nowrap">
                {formatMoney(payment.amountCents, payment.currency)}
              </td>
              <td className="py-3 pr-4">
                <StatusBadge status={payment.status} />
              </td>
              <td className="py-3 whitespace-nowrap">
                {payment.hostedInvoiceUrl ? (
                  <a
                    href={payment.hostedInvoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    View
                  </a>
                ) : (
                  <span className="text-neutral-500">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubscriptionEventsList({ events }: { events: SubscriptionEventDto[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Subscription activity will appear here when you upgrade or change your plan.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {events.map(event => (
        <li
          key={event.id}
          className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3"
        >
          <div>
            <p className="text-sm text-neutral-200">{event.description}</p>
            <p className="mt-1 text-xs text-neutral-500">{formatDateTime(event.occurredAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            {event.plan && <PlanBadge plan={event.plan} />}
            {event.status && <StatusBadge status={event.status} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PlanCard({
  entry,
  currentPlan,
  enabledFeatures,
  stripeConfigured,
  onUpgrade,
  upgrading,
}: {
  entry: PlanCatalogEntryDto;
  currentPlan: SubscriptionPlan;
  enabledFeatures: Feature[];
  stripeConfigured: boolean;
  onUpgrade: () => void;
  upgrading: boolean;
}) {
  const isCurrent = entry.plan === currentPlan;
  const isPro = entry.plan === 'PRO';
  const canUpgrade = isPro && !isCurrent && stripeConfigured;

  return (
    <article
      className={`rounded-xl border p-5 space-y-4 ${
        isCurrent
          ? 'border-indigo-500/50 bg-indigo-500/5'
          : 'border-neutral-800 bg-neutral-900/40'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-100">{entry.label}</h3>
          <p className="mt-1 text-sm text-neutral-400">{entry.description}</p>
        </div>
        {isCurrent && (
          <span className="text-xs uppercase tracking-wide text-indigo-300">Current</span>
        )}
      </header>

      <ul className="space-y-2 text-sm text-neutral-300">
        <li>Up to {entry.limits.maxDigestTopics} info digest topics</li>
        {entry.features.length === 0 ? (
          <li className="text-neutral-500">Core planning, chat, and tasks</li>
        ) : (
          entry.features.map(feature => (
            <li key={feature} className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              {FEATURE_LABELS[feature]}
            </li>
          ))
        )}
      </ul>

      {canUpgrade && (
        <Button
          type="button"
          onClick={onUpgrade}
          disabled={upgrading}
          content={upgrading ? 'Redirecting…' : 'Upgrade to Pro'}
          className="w-full"
        />
      )}

      {isPro && !isCurrent && !stripeConfigured && (
        <p className="text-xs text-neutral-500">Billing is not configured on this environment.</p>
      )}

      {isCurrent && enabledFeatures.length > 0 && (
        <p className="text-xs text-neutral-500">
          You have access to {enabledFeatures.length} premium feature
          {enabledFeatures.length === 1 ? '' : 's'}.
        </p>
      )}
    </article>
  );
}

const SubscriptionView: FC = () => {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const checkoutStatus = searchParams.get('checkout');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.subscriptionMe,
    queryFn: getSubscriptionMe,
    refetchInterval: checkoutStatus === 'success' ? 3000 : false,
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.subscriptionHistory,
    queryFn: getSubscriptionHistory,
    enabled: Boolean(data?.subscription.hasStripeCustomer),
    refetchInterval: checkoutStatus === 'success' ? 3000 : false,
  });

  const redirectToStripe = useCallback((url: string) => {
    window.location.href = url;
  }, []);

  const checkoutMutation = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: ({ url }) => redirectToStripe(url),
    onError: (error: Error) => setActionError(error.message),
  });

  const portalMutation = useMutation({
    mutationFn: createBillingPortalSession,
    onSuccess: ({ url }) => redirectToStripe(url),
    onError: (error: Error) => setActionError(error.message),
  });

  const handleUpgrade = () => {
    setActionError(null);
    checkoutMutation.mutate();
  };

  const hasActivePro =
    data?.subscription.plan === 'PRO' &&
    (data.subscription.status === 'ACTIVE' || data.subscription.status === 'TRIALING');

  const canManageBilling =
    Boolean(data?.stripeConfigured) && Boolean(data?.subscription.hasStripeCustomer);

  const openBillingPortal = useCallback(() => {
    setActionError(null);
    portalMutation.mutate();
  }, [portalMutation]);

  if (isPending) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-neutral-400">Loading subscription...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-red-400">Failed to load subscription details.</div>
      </div>
    );
  }

  const { subscription, features, plans, stripeConfigured } = data;
  const upgrading = checkoutMutation.isPending || portalMutation.isPending;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-100">Subscription</h1>
        <p className="text-sm text-neutral-400">
          Manage your plan and see which premium features are included.
        </p>
      </header>

      {checkoutStatus === 'success' && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Payment received. Your plan should update in a few seconds.
          <button
            type="button"
            className="ml-2 underline hover:text-emerald-100"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.subscriptionMe });
              queryClient.invalidateQueries({ queryKey: queryKeys.subscriptionHistory });
            }}
          >
            Refresh now
          </button>
        </div>
      )}

      {checkoutStatus === 'canceled' && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-300">
          Checkout was canceled. You can try again when you are ready.
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-red-600/50 bg-red-600/10 px-4 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      <Container>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium text-neutral-100">Current plan</h2>
              <PlanBadge plan={subscription.plan} />
            </div>
            <p className="mt-1 text-sm text-neutral-400">
              Status: <StatusBadge status={subscription.status} />
            </p>
            {subscription.currentPeriodEnd && (
              <p className="mt-1 text-xs text-neutral-500">
                Current period ends{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {subscription.cancelAtPeriodEnd ? ' (cancels at period end)' : ''}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!hasActivePro && stripeConfigured && (
              <Button
                type="button"
                onClick={handleUpgrade}
                disabled={upgrading}
                content={upgrading ? 'Redirecting…' : 'Upgrade to Pro'}
              />
            )}
            {canManageBilling && (
              <Button
                type="button"
                onClick={openBillingPortal}
                disabled={upgrading}
                content="Manage billing"
                className="bg-neutral-800 hover:bg-neutral-700"
              />
            )}
          </div>
        </div>
      </Container>

      {subscription.status === 'PAST_DUE' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p>
            Your last payment failed. Update your payment method in the billing portal to restore
            Pro access.
          </p>
          {canManageBilling && (
            <Button
              type="button"
              onClick={openBillingPortal}
              disabled={upgrading}
              content={upgrading ? 'Redirecting…' : 'Update payment method'}
              className="mt-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100"
            />
          )}
        </div>
      )}

      {features.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Your features
          </h2>
          <div className="flex flex-wrap gap-2">
            {features.map(feature => (
              <span
                key={feature}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
              >
                {FEATURE_LABELS[feature]}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Plans</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map(entry => (
            <PlanCard
              key={entry.plan}
              entry={entry}
              currentPlan={subscription.plan}
              enabledFeatures={features}
              stripeConfigured={stripeConfigured}
              onUpgrade={handleUpgrade}
              upgrading={upgrading}
            />
          ))}
        </div>
      </section>

      {(data.subscription.hasStripeCustomer || historyQuery.data) && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
              Payment history
            </h2>
            <Container>
              {historyQuery.isPending ? (
                <p className="text-sm text-neutral-500">Loading payments…</p>
              ) : (
                <PaymentHistoryTable payments={historyQuery.data?.payments ?? []} />
              )}
            </Container>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
              Subscription activity
            </h2>
            <Container>
              {historyQuery.isPending ? (
                <p className="text-sm text-neutral-500">Loading activity…</p>
              ) : (
                <SubscriptionEventsList events={historyQuery.data?.events ?? []} />
              )}
            </Container>
          </section>
        </>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4 text-sm text-neutral-400">
        <p>
          Payments are processed securely by Stripe. Subscription changes sync automatically via
          webhooks — no need to refresh after checkout unless your plan has not updated yet.
        </p>
        {/*<p className="mt-2">*/}
        {/*  Explore premium capabilities on the{' '}*/}
        {/*  <Link href="/me/insights" className="text-indigo-400 hover:text-indigo-300">*/}
        {/*    Insights*/}
        {/*  </Link>{' '}*/}
        {/*  and{' '}*/}
        {/*  <Link href="/me/info-digests" className="text-indigo-400 hover:text-indigo-300">*/}
        {/*    Info Digests*/}
        {/*  </Link>{' '}*/}
        {/*  pages.*/}
        {/*</p>*/}
      </section>
    </div>
  );
};

export default SubscriptionView;
