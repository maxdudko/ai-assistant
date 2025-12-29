'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/api/AuthContext';
import { authApi } from '@/lib/api/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      try {
        await authApi.register({ email, password });
        await refresh();
        router.push('/me');
      } catch (error) {
        console.error('Registration failed:', error);
        setError('Registration failed. Email may already be in use.');
      }
    },
    [email, password, refresh, router],
  );
  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-900 p-6">
        <h2 className="text-xl font-medium">Register</h2>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded bg-neutral-800 p-2"
          placeholder="Email"
          type="email"
          required
        />
        <input
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full rounded bg-neutral-800 p-2"
          type="password"
          placeholder="Password"
          required
          minLength={6}
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="w-full rounded bg-indigo-600 py-2 cursor-pointer">
          Create account
        </button>
      </form>
    </main>
  );
}
