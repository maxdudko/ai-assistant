'use client';

import React, { useEffect, useState } from 'react';

import { adminApi } from '@/lib/api/admin';
import type { AdminUserListItemDto } from '@/lib/api/types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="space-y-4">
      <h2 className="text-xl font-semibold">Users</h2>
      {loading && <p className="text-neutral-400">Loading users...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!loading && !error && (
        <div className="overflow-x-auto rounded border border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-900/70 text-left">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Display Name</th>
                <th className="p-3">Timezone</th>
                <th className="p-3">Onboarded</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-t border-neutral-800">
                  <td className="p-3">{user.email}</td>
                  <td className="p-3">{user.displayName ?? '-'}</td>
                  <td className="p-3">{user.timezone ?? '-'}</td>
                  <td className="p-3">{user.onboardingCompleted ? 'Yes' : 'No'}</td>
                  <td className="p-3">{user.subscriptionPlan ?? '-'}</td>
                  <td className="p-3">{user.subscriptionStatus ?? '-'}</td>
                  <td className="p-3">{new Date(user.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
