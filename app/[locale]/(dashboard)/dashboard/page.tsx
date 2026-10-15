"use client";

import { useTranslations } from "next-intl";
import { lazy, Suspense } from "react";
import { CreateGameButton } from "@/components/dashboard/create-game-button";
import { GameList } from "@/components/dashboard/game-list";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useCachedQuery } from "@/lib/use-cached-query";

// The dialog (Radix, focus trapping, scroll locking) loads after the page
// shows, keeping it out of the initial JavaScript; until then the button is
// shown without it.
const CreateGameDialog = lazy(() =>
  import("@/components/dashboard/create-game-dialog").then((mod) => ({
    default: mod.CreateGameDialog,
  }))
);

function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2.5">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {["a", "b", "c"].map((id) => (
          <div
            className="space-y-4 rounded-2xl border border-border/50 bg-card/50 p-5"
            key={id}
          >
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-full rounded-sm" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 rounded-lg" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-9 flex-1 rounded-xl" />
              <Skeleton className="size-9 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const games = useCachedQuery(api.games.list);

  if (games === undefined) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-10">
      {/* Header section */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="font-display font-semibold text-3xl text-foreground tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {games.length === 0
              ? t("emptyDesc")
              : `${games.length} ${games.length === 1 ? "game" : "games"} in your library`}
          </p>
        </div>
        <Suspense fallback={<CreateGameButton />}>
          <CreateGameDialog>
            <CreateGameButton />
          </CreateGameDialog>
        </Suspense>
      </div>

      {/* Game grid */}
      <GameList games={games} />
    </div>
  );
}
