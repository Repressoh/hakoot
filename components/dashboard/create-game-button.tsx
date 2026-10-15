"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/** The dashboard's "Create game" button, which opens CreateGameDialog. */
export function CreateGameButton(props: ComponentProps<typeof Button>) {
  const t = useTranslations();
  return (
    <Button
      className="press-down h-11 rounded-xl bg-primary px-5 font-bold font-display text-primary-foreground shadow-[0_0_15px_var(--glow-subtle)] transition hover:shadow-[0_0_25px_var(--glow-primary)] hover:brightness-110"
      {...props}
    >
      <svg
        aria-hidden="true"
        className="mr-2"
        fill="none"
        height="16"
        viewBox="0 0 16 16"
        width="16"
      >
        <path
          d="M8 3v10M3 8h10"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
      {t("dashboard.createGame")}
    </Button>
  );
}
