'use client';

import React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { TopNavbar, LeftSidebar } from '@/components/common/sidebar';
import { useAuth } from '@/lib/api/AuthContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const onboardingCompleted = Boolean(user?.profile?.onboardingCompleted);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user && !onboardingCompleted) {
      router.replace('/auth/onboarding');
    }
  }, [loading, user, onboardingCompleted, router]);

  if (loading || !user || !onboardingCompleted) {
    return <main className="flex-1 p-6" />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNavbar />
      <div className="flex flex-1 overflow-hidden relative">
        <LeftSidebar />
        <main className="flex-1 overflow-y-auto p-2 ml-16 md:ml-64">{children}</main>
      </div>
    </div>
  );
}
