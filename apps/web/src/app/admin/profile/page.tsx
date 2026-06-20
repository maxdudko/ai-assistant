'use client';

import React, { useEffect, useState } from 'react';

import Button from '@/components/common/button';
import Container from '@/components/common/container';
import PasswordInput from '@/components/common/password-input';
import { adminApi } from '@/lib/api/admin';
import type { AdminDto } from '@/lib/api/types';

export default function AdminProfilePage() {
  const [admin, setAdmin] = useState<AdminDto | null>(null);
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const me = await adminApi.me();
        if (isMounted) {
          setAdmin(me);
          setEmail(me.email);
        }
      } catch {
        if (isMounted) {
          setError('Failed to load profile');
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const onUpdateEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailMessage(null);
    setError(null);
    try {
      const updated = await adminApi.updateEmail({ email });
      setAdmin(updated);
      setEmail(updated.email);
      setEmailMessage('Email updated successfully.');
    } catch {
      setError('Failed to update email');
    }
  };

  const onUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await adminApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Password updated successfully.');
    } catch {
      setError('Failed to update password');
    }
  };

  return (
    <main className="space-y-4 max-w-3xl">
      <h2 className="text-xl font-semibold">Profile</h2>
      {admin && <p className="text-neutral-400 text-sm">Admin ID: {admin.id}</p>}
      {error && <p className="text-red-500">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <Container className="p-4">
          <h3 className="font-medium mb-4">Change Email</h3>
          <form className="space-y-4" onSubmit={onUpdateEmail}>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm text-neutral-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="w-full rounded bg-neutral-800 p-2"
                required
              />
            </div>
            {emailMessage && <p className="text-green-500 text-sm">{emailMessage}</p>}
            <Button type="submit" content="Update email" />
          </form>
        </Container>

        <Container className="p-4">
          <h3 className="font-medium mb-4">Change Password</h3>
          <form className="space-y-4" onSubmit={onUpdatePassword}>
            <div>
              <label htmlFor="currentPassword" className="mb-2 block text-sm text-neutral-300">
                Current password
              </label>
              <PasswordInput
                id="currentPassword"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
                placeholder="Current password"
                required
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="mb-2 block text-sm text-neutral-300">
                New password
              </label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                placeholder="New password (min 8 chars)"
                minLength={8}
                required
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm text-neutral-300">
                Confirm new password
              </label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                placeholder="Confirm new password"
                minLength={8}
                required
              />
            </div>
            {passwordMessage && <p className="text-green-500 text-sm">{passwordMessage}</p>}
            <Button type="submit" content="Update password" />
          </form>
        </Container>
      </div>
    </main>
  );
}
