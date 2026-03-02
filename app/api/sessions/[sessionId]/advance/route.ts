import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameSession, gameStep } from "@/lib/db/schema";
import { publish } from "@/lib/sse";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const authSession = await auth.api.getSession({ headers: await headers() });
  if (!authSession) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [gs] = await db
    .select()
    .from(gameSession)
    .where(
      and(
        eq(gameSession.id, sessionId),
        eq(gameSession.hostId, authSession.user.id)
      )
    );

  if (!gs) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (gs.status === "finished") {
    return Response.json(
      { error: "Session already finished" },
      { status: 400 }
    );
  }

  const steps = await db
    .select()
    .from(gameStep)
    .where(eq(gameStep.gameId, gs.gameId))
    .orderBy(gameStep.order);

  const nextIndex = gs.currentStepIndex + 1;

  if (nextIndex >= steps.length) {
    // End session
    await db
      .update(gameSession)
      .set({ status: "finished", updatedAt: new Date() })
      .where(eq(gameSession.id, sessionId));

    publish(sessionId, {
      type: "session_ended",
      data: { sessionId },
    });

    return Response.json({ status: "finished" });
  }

  const nextStep = steps[nextIndex];
  const now = new Date();

  const isStarting = gs.status === "waiting";

  await db
    .update(gameSession)
    .set({
      status: "in_progress",
      currentStepIndex: nextIndex,
      stepStartedAt: now,
      answerRevealed: false,
      updatedAt: now,
    })
    .where(eq(gameSession.id, sessionId));

  if (isStarting) {
    publish(sessionId, {
      type: "session_started",
      data: { sessionId },
    });
  }

  publish(sessionId, {
    type: "step_changed",
    data: {
      stepIndex: nextIndex,
      stepId: nextStep.id,
      stepType: nextStep.type,
      timeLimitSeconds: nextStep.timeLimitSeconds,
      stepStartedAt: now.toISOString(),
    },
  });

  if (nextStep.type === "quiz" && nextStep.timeLimitSeconds) {
    publish(sessionId, {
      type: "timer_started",
      data: {
        timeLimitSeconds: nextStep.timeLimitSeconds,
        stepStartedAt: now.toISOString(),
      },
    });
  }

  return Response.json({
    status: "in_progress",
    stepIndex: nextIndex,
    stepId: nextStep.id,
  });
}
