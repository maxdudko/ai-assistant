'use client';

import type { FC } from 'react';
import React, { useCallback, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { authApi } from '@/lib/api/auth';
import Container from '@/components/common/container';
import Button from '@/components/common/button';
import PasswordInput from '@/components/common/password-input';

const ResetPassword: FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (newPassword.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (!token) {
        setError('Invalid reset link. Please request a new one.');
        return;
      }

      try {
        await authApi.resetPassword({ token, newPassword });
        router.push('/auth/login');
      } catch (err) {
        console.error('Reset password failed:', err);
        setError('Invalid or expired link. Please request a new password reset.');
      }
    },
    [newPassword, confirmPassword, token, router],
  );

  if (!token) {
    return (
      <Container>
        <div className="w-full max-w-sm space-y-4 p-6">
          <h2 className="text-xl font-medium">Invalid link</h2>
          <p className="text-neutral-300 text-sm">
            This reset link is missing a token. Please use the link from your email or{' '}
            <a href="/auth/forgot-password" className="underline">
              request a new one
            </a>
            .
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
        <h2 className="text-xl font-medium">Set new password</h2>
        <p className="text-neutral-300 text-sm">
          Enter your new password below. It must be at least 8 characters.
        </p>
        <PasswordInput
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          placeholder="New password"
          minLength={8}
          required
        />
        <PasswordInput
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          minLength={8}
          required
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Button type="submit" className="w-full" content="Reset password" />
        <div className="text-right text-sm">
          <a href="/auth/login" className="underline">
            Back to login
          </a>
        </div>
      </form>
    </Container>
  );
};

export default ResetPassword;
