"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { CreateGameDialog } from "@/components/dashboard/create-game-dialog";
import { GameList } from "@/components/dashboard/game-list";
import { api } from "@/convex/_generated/api";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const games = useQuery(api.games.list);

  if (games === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-bold font-display text-2xl">{t("title")}</h1>
        <CreateGameDialog />
      </div>
      <GameList games={games} />
    </div>
  );
}
