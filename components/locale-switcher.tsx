"use client";

import { useLocale } from "next-intl";
import {
  type ComponentProps,
  lazy,
  Suspense,
  startTransition,
  useState,
} from "react";
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

// The dropdown (Radix menu, positioning and scroll locking) is ~36 KB of
// gzipped JavaScript. Fetched right after hydration, it still competed with
// the page's own loading on slow phones, so it now waits until the visitor
// reaches for the button: hovering fetches it, pressing it (or Enter, Space
// or an arrow key) fetches it and opens the menu once it arrives.
const LocaleMenu = lazy(() =>
  import("./locale-menu").then((mod) => ({ default: mod.LocaleMenu }))
);

/** Keys that open a Radix dropdown from its trigger. */
const OPEN_KEYS = new Set(["Enter", " ", "ArrowDown", "ArrowUp"]);

interface Props {
  variant?: "default" | "light";
}

/** Language switcher: the current locale, opening a menu of the others. */
export function LocaleSwitcher({ variant: _variant = "default" }: Props) {
  const [menu, setMenu] = useState<"none" | "load" | "open">("none");

  // In a transition, so the plain button stays (with its focus) until the
  // menu has loaded.
  const preload = () =>
    startTransition(() => setMenu((prev) => (prev === "none" ? "load" : prev)));
  const open = () => startTransition(() => setMenu("open"));

  const button = (
    <LocaleButton
      onKeyDown={(e) => {
        if (OPEN_KEYS.has(e.key)) {
          e.preventDefault();
          open();
        }
      }}
      onPointerDown={(e) => {
        if (e.button === 0 && !e.ctrlKey) {
          open();
        }
      }}
      onPointerEnter={preload}
    />
  );

  return (
    <Suspense fallback={button}>
      {menu === "none" ? (
        button
      ) : (
        <LocaleMenu defaultOpen={menu === "open"}>
          <LocaleButton />
        </LocaleMenu>
      )}
    </Suspense>
  );
}
