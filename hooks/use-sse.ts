"use client";

import { useEffect, useRef } from "react";
import type { SseEventType } from "@/lib/sse";

type SseHandler = (data: Record<string, unknown>) => void;
type Handlers = Partial<Record<SseEventType, SseHandler>>;

export function useSse(sessionId: string | null, handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const es = new EventSource(`/api/sessions/${sessionId}/stream`);

    const eventTypes: SseEventType[] = [
      "session_started",
      "session_ended",
      "step_changed",
      "timer_started",
      "answer_received",
      "answer_revealed",
      "participant_joined",
    ];

    for (const type of eventTypes) {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as Record<string, unknown>;
          handlersRef.current[type]?.(data);
        } catch {
          // ignore parse errors
        }
      });
    }

    es.onerror = () => {
      // EventSource auto-reconnects on error
    };

    return () => {
      es.close();
    };
  }, [sessionId]);
}
