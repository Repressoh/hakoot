import type { MetadataRoute } from "next";

/** robots.txt: allow public pages, keep crawlers out of the dashboard, host and player screens. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        allow: "/",
        disallow: ["/dashboard/", "/host/", "/session/"],
        userAgent: "*",
      },
    ],
    sitemap: "https://dev.hakoot.albertocaserta.it/sitemap.xml",
  };
}
