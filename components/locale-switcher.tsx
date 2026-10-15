"use client";

import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/** The current locale as a button; the menu adds its trigger props to it. */
function LocaleButton(props: ComponentProps<typeof Button>) {
  const locale = useLocale();
  return (
    <Button
      className="gap-1 font-mono text-muted-foreground text-xs uppercase hover:bg-muted/50 hover:text-foreground"
      size="sm"
      variant="ghost"
      {...props}
    >
      {locale}
    </Button>
  );
}

// The dropdown (Radix menu, positioning and scroll locking) is ~30 KB of
// JavaScript. Loaded after the page is interactive, it no longer delays
// hydration of the public pages; the bare button shows until then.
const LocaleMenu = dynamic(
  () => import("./locale-menu").then((mod) => mod.LocaleMenu),
  { loading: () => <LocaleButton />, ssr: false }
);

interface Props {
  variant?: "default" | "light";
}

/** Language switcher: the current locale, opening a menu of the others. */
export function LocaleSwitcher({ variant: _variant = "default" }: Props) {
  return (
    <LocaleMenu>
      <LocaleButton />
    </LocaleMenu>
  );
}
