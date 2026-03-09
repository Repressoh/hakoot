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

export function LocaleSwitcher({ variant: _variant = "default" }: Props) {
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
          className="gap-1 font-mono text-muted-foreground text-xs uppercase hover:bg-muted/50 hover:text-foreground"
          size="sm"
          variant="ghost"
        >
          {locale}
        </Button>
      </DropdownMenuTrigger>
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
