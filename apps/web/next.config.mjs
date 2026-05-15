/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@santaisabel/shared'],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
