import type { FC } from 'react';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { authApi } from '@/lib/api/auth';
import Button from '@/components/common/button';

const navItems = [
  { href: '/me/', label: 'Home' },
  { href: '/me/chat', label: 'Chat' },
  { href: '/me/conversations', label: 'Conversations' },
  { href: '/me/tasks', label: 'Tasks' },
  { href: '/me/goals', label: 'Goals' },
  { href: '/me/info-digests', label: 'Info Digests' },
  { href: '/me/memory', label: 'Memory' },
  { href: '/me/logs', label: 'Logs' },
  { href: '/me/profile', label: 'Profile' },
];

const NavItem: FC<{ href: string; label: string }> = ({ href, label }) => (
  <Link
    href={href}
    className="px-2 py-1 rounded hover:bg-indigo-800/20 hover:border hover:border-indigo-500/50"
  >
    {label}
  </Link>
);

const Navbar: FC = () => {
  const router = useRouter();

  return (
    <aside className="w-64 border-r border-neutral-800 p-4 flex flex-col justify-between">
      <nav className="flex flex-col gap-1">
        {navItems.map(item => (
          <NavItem key={item.href} href={item.href} label={item.label} />
        ))}
      </nav>
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={async () => {
            try {
              await authApi.logout();
            } finally {
              router.push('/auth/login');
            }
          }}
          content="Logout"
        />
      </div>
    </aside>
  );
};

export default Navbar;
