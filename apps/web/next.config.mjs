/** @type {import('next').NextConfig} */
const isHybrid = process.env.HYBRID_BUILD === '1';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nuxia2/shared-types'],
  ...(isHybrid
    ? {
        output: 'export',
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        output: 'standalone',
        images: {
          remotePatterns: [
            { protocol: 'https', hostname: '**' },
          ],
        },
        allowedDevOrigins: [
          '*.replit.dev',
          '*.replit.app',
          '*.spock.replit.dev',
          '*.picard.replit.dev',
          '*.repl.co',
        ],
      }),
};

export default nextConfig;
