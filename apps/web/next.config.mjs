/** @type {import('next').NextConfig} */
const isHybrid = process.env.HYBRID_BUILD === '1';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nuxia2/shared-types'],
  // 하이브리드 번들(capacitor)용 static export. 웹(Docker) 기본은 standalone.
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
      }),
};

export default nextConfig;
