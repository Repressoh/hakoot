import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";
import { locales } from "./locales";

export const routing = defineRouting({
  defaultLocale: "en",
  localePrefix: "always",
  locales,
});

export const { Link, usePathname, useRouter } = createNavigation(routing);
