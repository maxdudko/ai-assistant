import React from 'react';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <form className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-900 p-6">
        <h2 className="text-xl font-medium">Register</h2>
        <input className="w-full rounded bg-neutral-800 p-2" placeholder="Name" />
        <input className="w-full rounded bg-neutral-800 p-2" placeholder="Email" />
        <input
          className="w-full rounded bg-neutral-800 p-2"
          type="password"
          placeholder="Password"
        />
        <button className="w-full rounded bg-indigo-600 py-2">Create account</button>
      </form>
    </main>
  );
}
