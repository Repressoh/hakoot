"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SessionManager } from "./session-manager";

function SessionsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20 rounded-md" />
        <Skeleton className="h-4 w-4 rounded-sm" />
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-4 w-4 rounded-sm" />
        <Skeleton className="h-4 w-16 rounded-md" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
      <div className="space-y-3">
        {["s1", "s2"].map((id) => (
          <Skeleton className="h-24 w-full rounded-2xl" key={id} />
        ))}
      </div>
    </div>
  );
}

export default function SessionsPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const game = useQuery(api.games.get, { gameId: gameId as Id<"games"> });
  const sessions = useQuery(api.sessions.listForGame, {
    gameId: gameId as Id<"games">,
  });

  if (game === undefined || sessions === undefined) {
    return <SessionsSkeleton />;
  }

  if (game === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-2xl">
          ⚠️
        </div>
        <p className="font-bold font-display text-foreground">Game not found</p>
        <p className="mt-1 text-muted-foreground text-sm">
          It may have been deleted.
        </p>
      </div>
    );
  }

  return <SessionManager game={game} sessions={sessions} />;
}
