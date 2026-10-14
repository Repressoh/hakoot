import type { MetadataRoute } from "next";

/** Sitemap of the public, localized pages. */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://dev.hakoot.albertocaserta.it";

  return [
    {
      changeFrequency: "weekly",
      lastModified: new Date(),
      priority: 1,
      url: baseUrl,
    },
    {
      changeFrequency: "weekly",
      lastModified: new Date(),
      priority: 1,
      url: `${baseUrl}/en`,
    },
    {
      changeFrequency: "weekly",
      lastModified: new Date(),
      priority: 1,
      url: `${baseUrl}/it`,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.8,
      url: `${baseUrl}/en/join`,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.8,
      url: `${baseUrl}/it/join`,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.6,
      url: `${baseUrl}/en/sign-in`,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.6,
      url: `${baseUrl}/it/sign-in`,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.6,
      url: `${baseUrl}/en/sign-up`,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.6,
      url: `${baseUrl}/it/sign-up`,
    },
  ];
}
