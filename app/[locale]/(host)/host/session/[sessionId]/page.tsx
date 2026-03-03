"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { HostSessionView } from "./host-session-view";

export default function HostSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const data = useQuery(api.sessions.getForHost, {
    sessionId: sessionId as Id<"gameSessions">,
  });

  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Session not found</p>
      </div>
    );
  }

  return <HostSessionView data={data} />;
}
