"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { GameEditor } from "./game-editor";

export default function GameEditorPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const game = useQuery(api.games.getWithSteps, {
    gameId: gameId as Id<"games">,
  });

  if (game === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading game...</p>
      </div>
    );
  }

  if (game === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Game not found</p>
      </div>
    );
  }

  return <GameEditor game={game} />;
}
