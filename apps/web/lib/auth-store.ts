'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AuthTokens } from '@santaisabel/shared';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (tokens: AuthTokens | { accessToken: string; refreshToken: string }) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      setTokens: (tokens) =>
        set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      clear: () => set({ accessToken: null, refreshToken: null }),
    }),
    { name: 'santaisabel.auth' },
  ),
);

export function getAccessTokenSnapshot(): string | null {
  return useAuth.getState().accessToken;
}

export function getRefreshTokenSnapshot(): string | null {
  return useAuth.getState().refreshToken;
}
