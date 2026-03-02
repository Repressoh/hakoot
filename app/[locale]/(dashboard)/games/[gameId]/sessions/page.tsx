import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getGameWithSteps } from "@/lib/actions/game";
import { getSessionsForGame } from "@/lib/actions/session";
import { SessionManager } from "./session-manager";

interface Props {
  params: Promise<{ gameId: string }>;
}

async function SessionsContent({ gameId }: { gameId: string }) {
  const game = await getGameWithSteps(gameId).catch(() => null);

  if (!game) {
    notFound();
  }

  const sessions = await getSessionsForGame(gameId);

  return <SessionManager game={game} sessions={sessions} />;
}

export default async function SessionsPage({ params }: Props) {
  const { gameId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading sessions...</p>
        </div>
      }
    >
      <SessionsContent gameId={gameId} />
    </Suspense>
  );
}
