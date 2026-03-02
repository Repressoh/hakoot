"use client";

import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
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

interface Props {
  variant?: "default" | "light";
}

export function LocaleSwitcher({ variant = "default" }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: string) => {
    router.push(pathname, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={
            variant === "light"
              ? "gap-1 text-white/80 hover:bg-white/10 hover:text-white"
              : "gap-1"
          }
          size="sm"
          variant="ghost"
        >
          <span className="font-medium uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.entries(localeNames).map(([code, name]) => (
          <DropdownMenuItem
            className={locale === code ? "font-semibold" : ""}
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
