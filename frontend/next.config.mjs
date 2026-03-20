import { withSentryConfig } from "@sentry/nextjs";

/**
 * Build memory (Vercel / small CI runners):
 * - Lower parallelism: set NEXT_BUILD_CPUS=1 in project env if builds still OOM (default 2).
 * - Skip Sentry source-map upload step: set SENTRY_DISABLE_SOURCEMAP_UPLOAD=1 (saves RAM during build).
 */
const buildCpus = Math.min(
  4,
  Math.max(1, Number.parseInt(process.env.NEXT_BUILD_CPUS || "2", 10) || 2)
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Ignore type errors in dependencies (e.g. @ethereumjs/tx overload signature)
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
  experimental: {
    // Fewer parallel compile workers → lower peak RSS (slower build).
    cpus: buildCpus,
    optimizePackageImports: [
      "lucide-react",
      "react-icons",
      "@radix-ui/react-select",
      "@radix-ui/react-switch",
    ],
  },
  async redirects() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/019b9413-dacb-6826-2d02-09f283211209',
        permanent: false, // This ensures a temporary 307 redirect
        statusCode: 307,  // Explicitly set to 307 (recommended by Farcaster)
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG ?? undefined,
  project: process.env.SENTRY_PROJECT ?? undefined,
  ...(process.env.SENTRY_DISABLE_SOURCEMAP_UPLOAD === "1"
    ? {
        sourcemaps: {
          disable: true,
        },
      }
    : {}),
});

