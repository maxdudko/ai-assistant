'use client';

import type { FC } from 'react';
import React, { useEffect, useState } from 'react';

import Button from '@/components/common/button';
import Container from '@/components/common/container';
import { adminApi } from '@/lib/api/admin';
import type {
  AdminFeatureStateDto,
  AdminSubscriptionDetailDto,
  AdminSubscriptionListItemDto,
} from '@/lib/api/types';

type FeatureControl = 'default' | 'grant' | 'revoke';

const PLANS = ['FREE', 'PRO'] as const;
const STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE'] as const;

interface Props {
  subscription: AdminSubscriptionListItemDto;
  onClose: () => void;
  onSaved: () => void;
}

function controlFromState(state: AdminFeatureStateDto): FeatureControl {
  if (!state.override) {
    return 'default';
  }
  return state.override.allowed ? 'grant' : 'revoke';
}

function buildOverrides(
  featureStates: AdminFeatureStateDto[],
  controls: Record<string, FeatureControl>,
): Array<{ feature: string; allowed: boolean }> {
  const overrides: Array<{ feature: string; allowed: boolean }> = [];

  for (const state of featureStates) {
    const control = controls[state.feature] ?? 'default';
    if (control === 'default') {
      continue;
    }
    overrides.push({
      feature: state.feature,
      allowed: control === 'grant',
    });
  }

  return overrides;
}

const ManageSubscriptionModal: FC<Props> = ({ subscription, onClose, onSaved }) => {
  const [detail, setDetail] = useState<AdminSubscriptionDetailDto | null>(null);
  const [plan, setPlan] = useState(subscription.plan);
  const [status, setStatus] = useState(subscription.status);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(subscription.cancelAtPeriodEnd);
  const [featureControls, setFeatureControls] = useState<Record<string, FeatureControl>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await adminApi.getSubscription(subscription.id);
        if (!isMounted) {
          return;
        }
        setDetail(response);
        setPlan(response.plan);
        setStatus(response.status);
        setCancelAtPeriodEnd(response.cancelAtPeriodEnd);
        setFeatureControls(
          Object.fromEntries(
            response.featureStates.map(state => [state.feature, controlFromState(state)]),
          ),
        );
      } catch {
        if (isMounted) {
          setError('Failed to load subscription details');
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
  }, [subscription.id]);

  const onSave = async () => {
    if (!detail) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await adminApi.updateSubscription(subscription.id, {
        plan,
        status,
        cancelAtPeriodEnd,
      });
      await adminApi.setSubscriptionFeatures(subscription.id, {
        overrides: buildOverrides(detail.featureStates, featureControls),
      });
      onSaved();
      onClose();
    } catch {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <Container className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Manage subscription</h3>
            <p className="text-sm text-neutral-400">{subscription.userEmail}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading && <p className="text-neutral-400">Loading...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {!loading && detail && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="plan" className="mb-2 block text-sm text-neutral-300">
                  Plan
                </label>
                <select
                  id="plan"
                  value={plan}
                  onChange={event => setPlan(event.target.value)}
                  className="w-full rounded bg-neutral-800 p-2"
                >
                  {PLANS.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="status" className="mb-2 block text-sm text-neutral-300">
                  Status
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={event => setStatus(event.target.value)}
                  className="w-full rounded bg-neutral-800 p-2"
                >
                  {STATUSES.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cancelAtPeriodEnd}
                onChange={event => setCancelAtPeriodEnd(event.target.checked)}
                className="rounded"
              />
              Cancel at period end
            </label>

            <div className="space-y-3">
              <h4 className="font-medium">Features</h4>
              <p className="text-xs text-neutral-400">
                Default follows plan entitlements. Grant or revoke overrides apply on top.
              </p>
              {detail.featureStates.map(state => (
                <div
                  key={state.feature}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-800 p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{state.label}</p>
                    <p className="text-xs text-neutral-500">
                      Plan default: {state.planDefault ? 'On' : 'Off'} · Effective:{' '}
                      {state.effective ? 'On' : 'Off'}
                    </p>
                  </div>
                  <select
                    value={featureControls[state.feature] ?? 'default'}
                    onChange={event =>
                      setFeatureControls(current => ({
                        ...current,
                        [state.feature]: event.target.value as FeatureControl,
                      }))
                    }
                    className="rounded bg-neutral-800 p-2 text-sm"
                  >
                    <option value="default">Default (plan)</option>
                    <option value="grant">Force on</option>
                    <option value="revoke">Force off</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" content="Cancel" onClick={onClose} disabled={saving} />
              <Button
                type="button"
                content={saving ? 'Saving...' : 'Save changes'}
                onClick={() => void onSave()}
                disabled={saving}
              />
            </div>
          </>
        )}
      </Container>
    </div>
  );
};

export default ManageSubscriptionModal;
