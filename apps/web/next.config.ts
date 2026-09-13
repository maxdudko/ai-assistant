import type { NextConfig } from 'next';

const usePolling = process.env.WATCHPACK_POLLING === 'true';

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    if (dev && usePolling) {
      config.watchOptions = {
        poll: Number(process.env.CHOKIDAR_INTERVAL) || 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-cache, no-store, must-revalidate',
        },
        {
          key: 'Service-Worker-Allowed',
          value: '/',
        },
      ],
    },
  ],
};

export default nextConfig;
