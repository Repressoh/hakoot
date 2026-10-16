"use client";

import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCachedQuery } from "@/lib/use-cached-query";
import { GameEditor } from "./game-editor";

function EditorSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20 rounded-md" />
        <Skeleton className="size-4 rounded-sm" />
        <Skeleton className="h-4 w-32 rounded-md" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/50">
        <Skeleton className="h-1 w-full" />
        <div className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-xl" />
            <Skeleton className="h-6 w-32 rounded-md" />
          </div>
          <div className="max-w-xl space-y-4">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        {["s1", "s2"].map((id) => (
          <Skeleton className="h-16 w-full rounded-xl" key={id} />
        ))}
      </div>
    </div>
  );
}

export default function GameEditorPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const game = useCachedQuery(api.games.getEditorView, {
    gameId: gameId as Id<"games">,
  });

  if (game === undefined) {
    return <EditorSkeleton />;
  }

  if (game === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-2xl">
          ⚠️
        </div>
        <p className="font-bold font-display text-foreground">Game not found</p>
        <p className="mt-1 text-muted-foreground text-sm">
          It may have been deleted.
        </p>
      </div>
    );
  }

  return <GameEditor game={game} />;
}
