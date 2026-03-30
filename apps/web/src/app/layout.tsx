import React from 'react';

import { AuthProvider } from '@/lib/api/AuthContext';
import Particles from '@/components/common/particles';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100">
        <AuthProvider>{children}</AuthProvider>
        <Particles />
      </body>
    </html>
  );
}
