// next.config.ts

import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Configure Next.js for static export
  output: 'export',  // Make Next.js output a static site
  distDir: 'out',    // Set the output directory for static files

  // Additional configuration if required
  reactStrictMode: true,
};

export default nextConfig;
