import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  reactCompiler: true,
  // cacheComponents requires next-intl to support next/root-params
  // See: https://github.com/amannn/next-intl/issues/2229
  // cacheComponents: true,
  allowedDevOrigins: ["hakoot-dev.albertocaserta.it"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  experimental: {
    inlineCss: true,
    optimizeCss: true,
    cssChunking: "strict",
    optimizePackageImports: [
      "@hugeicons/core-free-icons",
      "@hugeicons/react",
      "motion",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "shiki",
      "react-markdown",
      "sonner",
    ],
  },
};

export default withNextIntl(nextConfig);
