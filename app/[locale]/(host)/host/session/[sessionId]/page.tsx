import type { Metadata } from "next";
import { HostSessionPage } from "./host-session-view";

export const metadata: Metadata = {
  title: "Host Session",
  description: "Host and manage a live game session",
};

export default async function HostSessionPageRoute({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <HostSessionPage sessionId={sessionId} />;
}
