'use client';

import React from 'react';

import Navbar from '@/components/navbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Navbar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
