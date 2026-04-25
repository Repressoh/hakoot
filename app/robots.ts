import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/host/", "/session/"],
      },
    ],
    sitemap: "https://dev.hakoot.albertocaserta.it/sitemap.xml",
  };
}
