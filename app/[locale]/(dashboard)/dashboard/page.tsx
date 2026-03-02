import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CreateGameDialog } from "@/components/dashboard/create-game-dialog";
import { GameList } from "@/components/dashboard/game-list";
import { getGames } from "@/lib/actions/game";

export const metadata: Metadata = { title: "Dashboard" };

async function DashboardContent() {
  const t = await getTranslations("dashboard");
  const games = await getGames();

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

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
