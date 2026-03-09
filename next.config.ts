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
