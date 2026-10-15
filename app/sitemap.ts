import type { MetadataRoute } from "next";
import { locales } from "@/i18n/locales";

const baseUrl = "https://dev.hakoot.albertocaserta.it";

/** Public pages, by path after the locale. */
const PAGES: {
  changeFrequency: "weekly" | "monthly";
  path: string;
  priority: number;
}[] = [
  { changeFrequency: "weekly", path: "", priority: 1 },
  { changeFrequency: "monthly", path: "/join", priority: 0.8 },
  { changeFrequency: "monthly", path: "/sign-in", priority: 0.6 },
  { changeFrequency: "monthly", path: "/sign-up", priority: 0.6 },
];

/**
 * Sitemap of the public, localized pages: every page in every locale, each linking all its
 * translations. The alternate-language links live here rather than in a `Link` header on every
 * response, where all the locales add ~7 KB to each page load.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      changeFrequency: "weekly",
      lastModified,
      priority: 1,
      url: baseUrl,
    },
    ...PAGES.flatMap(({ changeFrequency, path, priority }) => {
      const languages = Object.fromEntries(
        locales.map((locale) => [locale, `${baseUrl}/${locale}${path}`])
      );
      return locales.map((locale) => ({
        alternates: { languages },
        changeFrequency,
        lastModified,
        priority,
        url: `${baseUrl}/${locale}${path}`,
      }));
    }),
  ];
}
