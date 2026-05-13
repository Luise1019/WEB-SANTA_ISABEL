/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@santaisabel/shared'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
