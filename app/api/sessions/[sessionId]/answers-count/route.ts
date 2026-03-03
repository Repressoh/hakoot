import { and, count, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameParticipant, gameSession, gameStep, participantAnswer } from "@/lib/db/schema";

export async function GET(
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

  const steps = await db
    .select()
    .from(gameStep)
    .where(eq(gameStep.gameId, gs.gameId))
    .orderBy(gameStep.order);

  const currentStep = gs.currentStepIndex >= 0 ? steps[gs.currentStepIndex] : null;

  if (!currentStep || currentStep.type !== "quiz") {
    return Response.json({ answered: 0, total: 0, stepId: currentStep?.id ?? null });
  }

  const [answeredRow] = await db
    .select({ value: count() })
    .from(participantAnswer)
    .where(eq(participantAnswer.stepId, currentStep.id));

  const [totalRow] = await db
    .select({ value: count() })
    .from(gameParticipant)
    .where(eq(gameParticipant.sessionId, sessionId));

  return Response.json({
    answered: answeredRow?.value ?? 0,
    total: totalRow?.value ?? 0,
    stepId: currentStep.id,
  });
}
