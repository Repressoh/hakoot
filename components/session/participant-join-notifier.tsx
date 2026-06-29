"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface Participant {
  _id: string;
  name: string;
}

export function ParticipantJoinNotifier({
  participants,
}: {
  participants: Participant[];
}) {
  const seenIdsRef = useRef<Set<string> | null>(null);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    if (!seenIdsRef.current) {
      seenIdsRef.current = new Set();
    }
    const seenIds = seenIdsRef.current;

    if (isInitialMountRef.current) {
      for (const participant of participants) {
        seenIds.add(participant._id);
      }
      isInitialMountRef.current = false;
      return;
    }

    for (const participant of participants) {
      if (seenIds.has(participant._id)) {
        continue;
      }
      seenIds.add(participant._id);
      toast.info(`${participant.name} joined!`);
    }
  }, [participants]);

  return null;
}
