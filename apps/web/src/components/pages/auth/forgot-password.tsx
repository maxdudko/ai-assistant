'use client';

import type { FC } from 'react';
import React, { useCallback, useState } from 'react';

import { authApi } from '@/lib/api/auth';
import Container from '@/components/common/container';
import Button from '@/components/common/button';

const ForgotPassword: FC = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      try {
        await authApi.forgotPassword({ email });
        setSent(true);
      } catch (err) {
        console.error('Forgot password failed:', err);
        setError('Something went wrong. Please try again.');
      }
    },
    [email],
  );

  if (sent) {
    return (
      <Container>
        <div className="w-full max-w-sm space-y-4 p-6">
          <h2 className="text-xl font-medium">Check your email</h2>
          <p className="text-neutral-300 text-sm">
            If an account exists with <strong>{email}</strong>, you will receive a link to reset your
            password. The link expires in 1 hour.
          </p>
          <p className="text-neutral-400 text-sm">
            In development, the reset link is printed in the API server console.
          </p>
          <a href="/auth/login" className="underline text-sm">
            Back to login
          </a>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 p-6">
        <h2 className="text-xl font-medium">Forgot password</h2>
        <p className="text-neutral-300 text-sm">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded bg-neutral-800 p-2"
          placeholder="Email"
          type="email"
          required
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Button type="submit" className="w-full" content="Send reset link" />
        <div className="text-right text-sm">
          <a href="/auth/login" className="underline">
            Back to login
          </a>
        </div>
      </form>
    </Container>
  );
};

export default ForgotPassword;
