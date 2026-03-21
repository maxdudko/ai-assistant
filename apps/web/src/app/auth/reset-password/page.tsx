import { Suspense } from 'react';

import ResetPassword from '@/components/pages/auth/reset-password';

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<div className="text-neutral-400">Loading reset form...</div>}>
        <ResetPassword />
      </Suspense>
    </main>
  );
}
