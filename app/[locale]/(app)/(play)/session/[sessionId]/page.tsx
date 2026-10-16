import type { Metadata } from "next";
import { PlayerSessionView } from "./player-session-view";

export const metadata: Metadata = {
  description: "Join and play a live game session",
  title: "Game Session",
};

export default async function PlayerSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <PlayerSessionView sessionId={sessionId} />;
}
