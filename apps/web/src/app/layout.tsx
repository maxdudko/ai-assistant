import React from 'react';
import type { Metadata, Viewport } from 'next';

import { AuthProvider } from '@/lib/api/AuthContext';
import Particles from '@/components/common/particles';
import { QueryProvider } from '@/components/providers/query-provider';
import PwaProvider from '@/components/providers/pwa-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mira Assistant',
  description: 'Personal AI assistant for planning, tasks, and reflection',
  applicationName: 'Mira',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mira',
  },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100" suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>
            <PwaProvider>{children}</PwaProvider>
          </AuthProvider>
        </QueryProvider>
        <Particles />
      </body>
    </html>
  );
}
