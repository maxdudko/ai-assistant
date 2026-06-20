'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

import Container from '@/components/common/container';
import PasswordInput from '@/components/common/password-input';
import Button from '@/components/common/button';
import { adminApi } from '@/lib/api/admin';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await adminApi.login({ email, password });
      router.push('/admin/dashboard');
    } catch {
      setError('Invalid admin email or password');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Container className="w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">Admin Login</h2>
        <form onSubmit={onSubmit} className="space-y-4">
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
              placeholder="admin@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm text-neutral-300">
              Password
            </label>
            <PasswordInput
              id="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Password"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" content="Sign in" className="w-full" />
        </form>
      </Container>
    </main>
  );
}
