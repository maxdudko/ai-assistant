'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

import type { UserDto } from '../api/types';
import { userApi } from '../api/user';

import { ACCESS_TOKEN_TTL_MS, refreshSession } from './client';

interface AuthState {
  user: UserDto | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const me = await userApi.me();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const intervalMs = Math.max(60_000, Math.floor(ACCESS_TOKEN_TTL_MS / 2));
    const id = window.setInterval(() => {
      void refreshSession();
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshSession();
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user]);

  return <AuthContext.Provider value={{ user, loading, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
