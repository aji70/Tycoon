import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

import { withSentryConfig } from "@sentry/nextjs";

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
  experimental: {
    cpus: 2,
    optimizePackageImports: [
      "lucide-react",
      "react-icons",
      "@radix-ui/react-select",
      "@radix-ui/react-switch",
      "@tanstack/react-query",
      "wagmi",
      "viem",
    ],
  },
};

export default withBundleAnalyzer(withSentryConfig(nextConfig, {
  silent: !process.env.CI,
}));
