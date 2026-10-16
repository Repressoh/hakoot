"use client";

import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import type { AutosaveStatus } from "@/lib/autosave";
import { cn } from "@/lib/utils";

/** Shows whether the step's latest changes are stored, in place of a save button. */
export function SaveStatus({ status }: { status: AutosaveStatus }) {
  const t = useTranslations("stepEditor");

  let icon = CheckmarkCircle02Icon;
  let label = t("saved");
  if (status === "error") {
    icon = Alert02Icon;
    label = t("saveFailed");
  } else if (status !== "saved") {
    icon = Loading03Icon;
    label = t("saving");
  }

  return (
    <p
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 text-muted-foreground text-sm",
        status === "error" && "text-destructive"
      )}
      role="status"
    >
      <HugeiconsIcon
        aria-hidden="true"
        className={cn(
          "size-4",
          (status === "pending" || status === "saving") && "animate-spin"
        )}
        icon={icon}
        strokeWidth={2}
      />
      {label}
    </p>
  );
}
