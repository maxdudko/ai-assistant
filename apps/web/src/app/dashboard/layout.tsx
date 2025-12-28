import React from 'react';
import Link from 'next/link';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r border-neutral-800 p-4">
        <nav className="flex flex-col gap-2">
          <Link href="/dashboard/chat">Chat</Link>
          <Link href="/dashboard/profile">Profile</Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
