"use client";

import { useLocale } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/routing";

const localeNames: Record<string, string> = {
  en: "English",
  it: "Italiano",
};

/** Opens the list of locales from `children`, the trigger button. */
export function LocaleMenu({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const { push } = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: string) => {
    push(pathname, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="surface-elevated min-w-[120px] border-border"
      >
        {Object.entries(localeNames).map(([code, name]) => (
          <DropdownMenuItem
            className={`text-foreground focus:bg-muted/50 ${locale === code ? "font-semibold text-primary" : ""}`}
            key={code}
            onClick={() => switchLocale(code)}
          >
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
