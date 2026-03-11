import type { Metadata } from "next";
import { SessionResultsView } from "./session-results-view";

export const metadata: Metadata = {
  title: "Session Results",
  description: "View the results and leaderboard for a completed game session",
};

export default async function SessionResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <SessionResultsView sessionId={sessionId} />;
}
