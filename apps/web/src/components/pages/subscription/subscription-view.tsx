'use client';

import type { FC } from 'react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { getSubscriptionMe } from '@/lib/api/subscriptions';
import type { Feature, PlanCatalogEntryDto, SubscriptionPlan } from '@/lib/api/types';
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
    status === 'ACTIVE' || status === 'TRIALING'
      ? 'text-emerald-300'
      : status === 'PAST_DUE'
        ? 'text-amber-300'
        : 'text-neutral-400';
  return <span className={`text-sm ${tone}`}>{status.replace('_', ' ')}</span>;
}

function PlanCard({
  entry,
  currentPlan,
  enabledFeatures,
}: {
  entry: PlanCatalogEntryDto;
  currentPlan: SubscriptionPlan;
  enabledFeatures: Feature[];
}) {
  const isCurrent = entry.plan === currentPlan;
  const isPro = entry.plan === 'PRO';

  return (
    <article
      className={`rounded-xl border p-5 space-y-4 ${
        isCurrent ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-neutral-800 bg-neutral-900/40'
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

      {isPro && !isCurrent && (
        <Button disabled className="w-full opacity-60 cursor-not-allowed">
          Upgrade with Stripe — coming soon
        </Button>
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
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.subscriptionMe,
    queryFn: getSubscriptionMe,
  });

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

  const { subscription, features, plans } = data;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-100">Subscription</h1>
        <p className="text-sm text-neutral-400">
          Manage your plan and see which premium features are included.
        </p>
      </header>

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
          {subscription.plan === 'FREE' && (
            <Button disabled className="opacity-60 cursor-not-allowed">
              Upgrade to Pro
            </Button>
          )}
        </div>
      </Container>

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
            />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4 text-sm text-neutral-400">
        <p>
          Stripe checkout and billing portal integration will connect here. Subscription state is
          stored with Stripe-ready fields so upgrades sync automatically once billing is enabled.
        </p>
        <p className="mt-2">
          Explore premium capabilities on the{' '}
          <Link href="/me/insights" className="text-indigo-400 hover:text-indigo-300">
            Insights
          </Link>{' '}
          and{' '}
          <Link href="/me/info-digests" className="text-indigo-400 hover:text-indigo-300">
            Info Digests
          </Link>{' '}
          pages.
        </p>
      </section>
    </div>
  );
};

export default SubscriptionView;
