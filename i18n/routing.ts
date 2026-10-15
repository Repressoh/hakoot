import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";
import { locales } from "./locales";

export const routing = defineRouting({
  // The hreflang alternates are in app/sitemap.ts: as a Link header they
  // would add ~7 KB (one entry per locale) to every response.
  alternateLinks: false,
  defaultLocale: "en",
  localePrefix: "always",
  locales,
});

export const { Link, usePathname, useRouter } = createNavigation(routing);
