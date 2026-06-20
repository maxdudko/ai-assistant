'use client';

import React, { useCallback, useEffect, useState } from 'react';

import { adminApi } from '@/lib/api/admin';
import type { AdminUserListItemDto } from '@/lib/api/types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setError(null);
    const response = await adminApi.getUsers();
    setUsers(response);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await adminApi.getUsers();
        if (isMounted) {
          setUsers(response);
        }
      } catch {
        if (isMounted) {
          setError('Failed to load users');
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

  const runAction = async (userId: string, action: () => Promise<void>) => {
    setActionError(null);
    setPendingUserId(userId);
    try {
      await action();
      await loadUsers();
    } catch {
      setActionError('Action failed. Please try again.');
    } finally {
      setPendingUserId(null);
    }
  };

  const onSuspend = (user: AdminUserListItemDto) => {
    if (!window.confirm(`Suspend ${user.email}? They will be signed out and cannot log in.`)) {
      return;
    }
    void runAction(user.id, async () => {
      await adminApi.suspendUser(user.id);
    });
  };

  const onUnsuspend = (user: AdminUserListItemDto) => {
    void runAction(user.id, async () => {
      await adminApi.unsuspendUser(user.id);
    });
  };

  const onDelete = (user: AdminUserListItemDto) => {
    if (
      !window.confirm(
        `Permanently delete ${user.email}? This removes their account and related data.`,
      )
    ) {
      return;
    }
    void runAction(user.id, async () => {
      await adminApi.deleteUser(user.id);
    });
  };

  return (
    <main className="space-y-4">
      <h2 className="text-xl font-semibold">Users</h2>
      {loading && <p className="text-neutral-400">Loading users...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {actionError && <p className="text-red-500">{actionError}</p>}
      {!loading && !error && (
        <div className="overflow-x-auto rounded border border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-900/70 text-left">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Display Name</th>
                <th className="p-3">Account</th>
                <th className="p-3">Timezone</th>
                <th className="p-3">Onboarded</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const isSuspended = Boolean(user.suspendedAt);
                const isPending = pendingUserId === user.id;

                return (
                  <tr key={user.id} className="border-t border-neutral-800">
                    <td className="p-3">{user.email}</td>
                    <td className="p-3">{user.displayName ?? '-'}</td>
                    <td className="p-3">
                      {isSuspended ? (
                        <span className="text-amber-400">Suspended</span>
                      ) : (
                        <span className="text-green-400">Active</span>
                      )}
                    </td>
                    <td className="p-3">{user.timezone ?? '-'}</td>
                    <td className="p-3">{user.onboardingCompleted ? 'Yes' : 'No'}</td>
                    <td className="p-3">{user.subscriptionPlan ?? '-'}</td>
                    <td className="p-3">{user.subscriptionStatus ?? '-'}</td>
                    <td className="p-3">{new Date(user.createdAt).toLocaleString()}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {isSuspended ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => onUnsuspend(user)}
                            className="rounded border border-green-600 px-2 py-1 text-xs hover:bg-green-600/20 disabled:opacity-50 cursor-pointer"
                          >
                            Unsuspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => onSuspend(user)}
                            className="rounded border border-amber-600 px-2 py-1 text-xs hover:bg-amber-600/20 disabled:opacity-50 cursor-pointer"
                          >
                            Suspend
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => onDelete(user)}
                          className="rounded border border-red-600 px-2 py-1 text-xs hover:bg-red-600/20 disabled:opacity-50 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
