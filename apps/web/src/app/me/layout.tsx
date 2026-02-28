'use client';

import React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import Sidebar from '@/components/common/sidebar';
import { useAuth } from '@/lib/api/AuthContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <main className="flex-1 p-6" />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
