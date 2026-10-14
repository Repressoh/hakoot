import type { MetadataRoute } from "next";

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
