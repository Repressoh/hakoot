import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin({
  experimental: {
    // Compiles the ICU messages at build time, so the ICU parser (~12KB
    // gzipped) stays out of the client bundle. The build fails on a malformed
    // message; i18n/messages.test.ts catches those first.
    messages: {
      format: "json",
      locales: "infer",
      path: "./messages",
      precompile: true,
      sourceLocale: "en",
    },
  },
  requestConfig: "./i18n/request.ts",
});

const nextConfig: NextConfig = {
  // cacheComponents requires next-intl to support next/root-params
  // See: https://github.com/amannn/next-intl/issues/2229
  // cacheComponents: true,
  allowedDevOrigins: ["hakoot-dev.albertocaserta.it"],
  experimental: {
    // The stylesheet is inlined in the HTML. Linked, it competes for
    // bandwidth with a dozen JavaScript chunks requested at the same moment,
    // so on a cold 2G load the first paint came at 4.9s instead of 1.6s.
    // The cost: each full page load carries the CSS (twice: a <style> tag and
    // a copy in the RSC payload, ~48KB gzipped) instead of reading it from
    // the cache, ~1.3s more on a warm 2G load. In-app navigations don't
    // include it. optimizeCss only applies to the Pages Router.
    inlineCss: true,
    optimizePackageImports: [
      "@hugeicons/core-free-icons",
      "@hugeicons/react",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "shiki",
      "react-markdown",
      "sonner",
    ],
  },
  /** Security headers (HSTS, CSP, framing, referrer and permissions policies) for every route. */
  async headers() {
    return [
      {
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
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud wss://*.convex.site https://challenges.cloudflare.com",
              "frame-src 'self' https://challenges.cloudflare.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
        source: "/:path*",
      },
    ];
  },
  output: "standalone",
  reactCompiler: true,
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
