import { PlayerSessionView } from "./player-session-view";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function PlayerSessionPage({ params }: Props) {
  const { sessionId } = await params;
  return <PlayerSessionView sessionId={sessionId} />;
}
