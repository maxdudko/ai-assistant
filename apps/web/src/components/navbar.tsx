import type { FC } from 'react';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { authApi } from '@/lib/api/auth';

const Navbar: FC = () => {
  const router = useRouter();

  return (
    <aside className="w-64 border-r border-neutral-800 p-4 flex flex-col justify-between">
      <nav className="flex flex-col gap-2">
        <Link href="/me/">Home</Link>
        <Link href="/me/chat">Chat</Link>
        <Link href="/me/profile">Profile</Link>
      </nav>
      <div className="flex justify-end">
        <button
          className="cursor-pointer "
          onClick={async () => {
            await authApi.logout();
            router.push('/me');
          }}
        >
          Exit
        </button>
      </div>
    </aside>
  );
};

export default Navbar;
