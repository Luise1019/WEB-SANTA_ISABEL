/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@santaisabel/shared'],
  experimental: {
    typedRoutes: false,
  },
  // ── Proxy API calls in production ──────────────────────────────
  // When NEXT_PUBLIC_API_URL starts with "/" (relative), Next.js rewrites
  // /api/v1/* → API_INTERNAL_URL (Railway internal network or localhost)
  // This avoids CORS and exposes only one public domain.
  async rewrites() {
    const internalApiUrl =
      process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${internalApiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
