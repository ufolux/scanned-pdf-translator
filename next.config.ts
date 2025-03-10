import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  serverExternalPackages: [
    'puppeteer-extra-plugin-stealth', 
    'playwright-extra',
  ],
};

export default nextConfig;
