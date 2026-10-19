"use client";

import { useTranslations } from "next-intl";

/**
 * Card shown when a share link no longer works: on the share page, and to whoever hosts (or
 * hosted) a session started from it once the owner turned the link off or reset it.
 */
export function LinkUnavailable() {
  const t = useTranslations("sharing");
  return (
    <div className="surface-raised w-full max-w-md space-y-2 p-8 text-center">
      <div
        aria-hidden="true"
        className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-2xl"
      >
        🔗
      </div>
      <h1 className="font-display font-semibold text-foreground text-xl">
        {t("notFoundTitle")}
      </h1>
      <p className="text-muted-foreground text-sm">
        {t("notFoundDescription")}
      </p>
    </div>
  );
}
