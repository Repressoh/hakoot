"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export function ConnectedProvider({
  icon,
  name,
  linked,
  loading,
}: {
  icon: string;
  name: string;
  linked: boolean;
  loading: boolean;
}) {
  const t = useTranslations("settings");
  let badge: ReactNode;
  if (loading) {
    badge = <span className="h-5 w-16 animate-pulse rounded-md bg-muted" />;
  } else if (linked) {
    badge = (
      <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-medium text-primary text-xs ring-1 ring-primary/20">
        {t("connected")}
      </span>
    );
  } else {
    badge = (
      <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground text-xs ring-1 ring-border/30">
        {t("notConnected")}
      </span>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted font-bold text-foreground text-sm ring-1 ring-border/40">
          {icon}
        </span>
        <span className="font-medium text-foreground text-sm">{name}</span>
      </div>
      {badge}
    </div>
  );
}
