'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AuthTokens } from '@santaisabel/shared';

type JwtUser = {
  sub: string;
  email: string;
  role: string;
  fullName?: string;
};

function decodeJwt(token: string): JwtUser | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded as JwtUser;
  } catch {
    return null;
  }
}

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: JwtUser | null;
  setTokens: (tokens: AuthTokens | { accessToken: string; refreshToken: string }) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: decodeJwt(tokens.accessToken),
        }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
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
