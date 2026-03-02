export type SseEventType =
  | "session_started"
  | "session_ended"
  | "step_changed"
  | "timer_started"
  | "answer_received"
  | "answer_revealed"
  | "participant_joined";

export interface SseEvent {
  data: Record<string, unknown>;
  type: SseEventType;
}

type Controller = ReadableStreamDefaultController<Uint8Array>;

/** In-memory pub/sub: sessionId -> set of SSE stream controllers */
const sessions = new Map<string, Set<Controller>>();

function encode(event: SseEvent): Uint8Array {
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  return new TextEncoder().encode(payload);
}

export function subscribe(sessionId: string): ReadableStream<Uint8Array> {
  let controller!: Controller;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, new Set());
      }
      sessions.get(sessionId)?.add(controller);
    },
    cancel() {
      sessions.get(sessionId)?.delete(controller);
      if (sessions.get(sessionId)?.size === 0) {
        sessions.delete(sessionId);
      }
    },
  });

  return stream;
}

export function publish(sessionId: string, event: SseEvent): void {
  const controllers = sessions.get(sessionId);
  if (!controllers) {
    return;
  }

  const data = encode(event);
  const dead: Controller[] = [];

  for (const ctrl of controllers) {
    try {
      ctrl.enqueue(data);
    } catch {
      dead.push(ctrl);
    }
  }

  for (const ctrl of dead) {
    controllers.delete(ctrl);
  }
}

export function getSubscriberCount(sessionId: string): number {
  return sessions.get(sessionId)?.size ?? 0;
}
