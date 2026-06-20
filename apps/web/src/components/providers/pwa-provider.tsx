'use client';

import type { FC, ReactNode } from 'react';
import { useEffect } from 'react';

import { registerServiceWorker } from '@/lib/pwa/service-worker';

const PwaProvider: FC<{ children: ReactNode }> = ({ children }) => {
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  return children;
};

export default PwaProvider;
