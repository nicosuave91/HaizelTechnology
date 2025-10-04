import { config } from '@haizel/config';

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
  env: {
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:4000',
    WEB_FEATURE_FLAG_PROVIDER: config.featureFlags.UNLEASH_URL,
  },
};

export default nextConfig;
