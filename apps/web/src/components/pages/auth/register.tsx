'use client';

import type { FC } from 'react';
import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useAuth } from '@/lib/api/AuthContext';
import { authApi } from '@/lib/api/auth';
import Container from '@/components/common/container';
import Button from '@/components/common/button';
import PasswordInput from '@/components/common/password-input';

const Register: FC = () => {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      try {
        await authApi.register({ email, password });
        await refresh();
        router.push('/auth/onboarding');
      } catch (error) {
        console.error('Registration failed:', error);
        setError('Registration failed. Email may already be in use.');
      }
    },
    [email, password, confirmPassword, refresh, router],
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
        <h2 className="text-xl font-medium">Register</h2>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded bg-neutral-800 p-2"
          placeholder="Email"
          type="email"
          required
        />
        <PasswordInput
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={6}
        />
        <PasswordInput
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Confirm Password"
          required
          minLength={6}
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Button type="submit" className="w-full" content="Create account" />
        <div className="text-right">
          Already have an account?{' '}
          <a href="/auth/login" className="underline">
            Login
          </a>
        </div>
      </form>
    </Container>
  );
};

export default Register;
