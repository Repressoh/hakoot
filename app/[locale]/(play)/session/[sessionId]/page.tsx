"use client";

import { useParams } from "next/navigation";
import { PlayerSessionView } from "./player-session-view";

export default function PlayerSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <PlayerSessionView sessionId={sessionId} />;
}
