import React from 'react';

import { AuthProvider } from '@/lib/api/AuthContext';
import Particles from '@/components/common/particles';
import { QueryProvider } from '@/components/providers/query-provider';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100" suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
        <Particles />
      </body>
    </html>
  );
}
