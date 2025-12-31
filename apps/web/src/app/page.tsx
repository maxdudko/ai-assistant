import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold">PMA — Personal Manager Assistant</h1>
      <div className="flex gap-4">
        <Link href="/auth/login" className="underline">
          Login
        </Link>
        <Link href="/auth/register" className="underline">
          Register
        </Link>
      </div>
    </main>
  );
}
