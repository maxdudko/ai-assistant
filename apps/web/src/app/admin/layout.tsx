'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { adminApi } from '@/lib/api/admin';
import type { AdminDto } from '@/lib/api/types';

const adminNavItems = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/subscriptions', label: 'Subscriptions' },
  { href: '/admin/profile', label: 'Profile' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminDto | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const loadAdmin = async () => {
      try {
        const me = await adminApi.me();
        if (isMounted) {
          setAdmin(me);
        }
      } catch {
        if (isMounted) {
          setAdmin(null);
          router.replace('/admin/login');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadAdmin();

    return () => {
      isMounted = false;
    };
  }, [isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading || !admin) {
    return <main className="min-h-screen" />;
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded border border-neutral-800 bg-neutral-900/70 p-4">
        <div>
          <h1 className="text-lg font-semibold">Admin Panel</h1>
          <p className="text-sm text-neutral-400">{admin.email}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await adminApi.logout();
            router.push('/admin/login');
          }}
          className="rounded border border-indigo-500 px-4 py-2 hover:bg-indigo-500 transition-colors cursor-pointer"
        >
          Logout
        </button>
      </header>

      <nav className="flex flex-wrap gap-2">
        {adminNavItems.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded border px-4 py-2 transition-colors ${
                isActive
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                  : 'border-neutral-700 hover:border-indigo-500'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
