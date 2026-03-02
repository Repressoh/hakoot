import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // cacheComponents requires next-intl to support next/root-params
  // See: https://github.com/amannn/next-intl/issues/2229
  // cacheComponents: true,
};

export default withNextIntl(nextConfig);
