'use client';

import type { FC } from 'react';
import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/api/AuthContext';
import { authApi } from '@/lib/api/auth';

const Login: FC = () => {
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
        await authApi.login({ email, password });
        await refresh();
        router.push('/me');
      } catch (error) {
        console.error('Login failed:', error);
        setError('Invalid email or password');
      }
    },
    [email, password, refresh, router],
  );

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-900 p-6">
      <h2 className="text-xl font-medium">Login</h2>
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full rounded bg-neutral-800 p-2"
        placeholder="Email"
      />
      <input
        value={password}
        onChange={e => setPassword(e.target.value)}
        className="w-full rounded bg-neutral-800 p-2"
        type="password"
        placeholder="Password"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" className="w-full rounded bg-indigo-600 py-2 cursor-pointer">
        Sign in
      </button>
      <div className="text-right">
        Don&#39;t have an account?{' '}
        <a href="/auth/register" className="underline">
          Register
        </a>
      </div>
    </form>
  );
};

export default Login;
