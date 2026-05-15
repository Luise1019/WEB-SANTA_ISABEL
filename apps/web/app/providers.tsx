'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { configureApiAuth } from '@/lib/api-client';
import { getAccessTokenSnapshot, getRefreshTokenSnapshot, useAuth } from '@/lib/auth-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setTokens = useAuth((s) => s.setTokens);
  const clear = useAuth((s) => s.clear);

  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              if (error && typeof error === 'object' && 'status' in error && (error as { status?: number }).status === 401) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      }),
  );

  useEffect(() => {
    configureApiAuth({
      getAccessToken: getAccessTokenSnapshot,
      getRefreshToken: getRefreshTokenSnapshot,
      onTokensRefreshed: (tokens) => setTokens(tokens),
      onUnauthorized: () => {
        clear();
        router.push('/login');
      },
    });
  }, [clear, router, setTokens]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
