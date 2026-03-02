import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getGameWithSteps } from "@/lib/actions/game";
import { GameEditor } from "./game-editor";

interface Props {
  params: Promise<{ gameId: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gameId } = await params;
  const game = await getGameWithSteps(gameId).catch(() => null);
  return { title: game?.title ?? "Game Editor" };
}

async function GameEditorContent({ gameId }: { gameId: string }) {
  const game = await getGameWithSteps(gameId).catch(() => null);

  if (!game) {
    notFound();
  }

  return <GameEditor game={game} />;
}

export default async function GameEditorPage({ params }: Props) {
  const { gameId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading game...</p>
        </div>
      }
    >
      <GameEditorContent gameId={gameId} />
    </Suspense>
  );
}
