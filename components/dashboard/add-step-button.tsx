"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/** The game editor's "Add step" button, which opens AddStepMenu. */
export function AddStepButton(props: ComponentProps<typeof Button>) {
  const t = useTranslations("gameEditor");
  return (
    <Button
      className="glow-sm press-down rounded-xl bg-primary font-bold font-display text-primary-foreground hover:brightness-110"
      size="sm"
      {...props}
    >
      <svg
        aria-hidden="true"
        className="mr-1.5"
        fill="none"
        height="14"
        viewBox="0 0 14 14"
        width="14"
      >
        <path
          d="M7 2v10M2 7h10"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
      {t("addStep")}
    </Button>
  );
}
