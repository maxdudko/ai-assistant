'use client';

import type { FC } from 'react';
import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useAuth } from '@/lib/api/AuthContext';
import { authApi } from '@/lib/api/auth';
import { userApi } from '@/lib/api/user';
import Container from '@/components/common/container';
import Button from '@/components/common/button';
import PasswordInput from '@/components/common/password-input';

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
        const me = await userApi.me();
        await refresh();
        if (me.profile?.onboardingCompleted) {
          router.push('/me');
        } else {
          router.push('/auth/onboarding');
        }
      } catch (error) {
        console.error('Login failed:', error);
        setError('Invalid email or password');
      }
    },
    [email, password, refresh, router],
  );

  return (
    <Container className="flex flex-col items-center px-4 py-12">
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
          <span className="text-white font-bold text-lg">AI</span>
        </div>
        <span className="hidden md:block text-xl font-semibold text-neutral-100">Assistant</span>
      </Link>
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 p-6">
        <h2 className="text-xl font-medium">Login</h2>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded bg-neutral-800 p-2"
          placeholder="Email"
        />
        <PasswordInput
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="text-right text-sm">
          <a href="/auth/forgot-password" className="underline">
            Forgot password?
          </a>
        </div>
        <Button type="submit" className="w-full" content="Sign in" />
        <div className="text-right">
          Don&#39;t have an account?{' '}
          <a href="/auth/register" className="underline">
            Register
          </a>
        </div>
      </form>
    </Container>
  );
};

export default Login;
