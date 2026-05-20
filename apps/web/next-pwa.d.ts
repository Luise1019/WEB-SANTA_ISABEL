declare module 'next-pwa' {
  import type { NextConfig } from 'next';
  type PWAConfig = {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    clientsClaim?: boolean;
    disable?: boolean;
    scope?: string;
    sw?: string;
    runtimeCaching?: unknown[];
    buildExcludes?: (string | RegExp)[];
    publicExcludes?: string[];
  };
  export default function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;
}
