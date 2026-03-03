"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SessionManager } from "./session-manager";

export default function SessionsPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const game = useQuery(api.games.get, { gameId: gameId as Id<"games"> });
  const sessions = useQuery(api.sessions.listForGame, { gameId: gameId as Id<"games"> });

  if (game === undefined || sessions === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading sessions...</p>
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

  return <SessionManager game={game} sessions={sessions} />;
}
