import { and, count, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  gameParticipant,
  gameSession,
  gameStep,
  participantAnswer,
} from "@/lib/db/schema";
import { publish } from "@/lib/sse";
import { computeScore } from "@/lib/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const cookieStore = await cookies();
  const participantToken = cookieStore.get(`participant_${sessionId}`)?.value;

  if (!participantToken) {
    return Response.json({ error: "Not a participant" }, { status: 403 });
  }

  const [participant] = await db
    .select()
    .from(gameParticipant)
    .where(eq(gameParticipant.participantToken, participantToken));

  if (!participant || participant.sessionId !== sessionId) {
    return Response.json({ error: "Participant not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.choiceIndex !== "number") {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { choiceIndex } = body as { choiceIndex: number };

  const [gs] = await db
    .select()
    .from(gameSession)
    .where(eq(gameSession.id, sessionId));

  if (!gs || gs.status !== "in_progress") {
    return Response.json({ error: "Session not active" }, { status: 400 });
  }

  if (gs.answerRevealed) {
    return Response.json({ error: "Answer already revealed" }, { status: 400 });
  }

  const steps = await db
    .select()
    .from(gameStep)
    .where(eq(gameStep.gameId, gs.gameId))
    .orderBy(gameStep.order);

  const currentStep = steps[gs.currentStepIndex];
  if (!currentStep || currentStep.type !== "quiz") {
    return Response.json(
      { error: "Current step is not a quiz" },
      { status: 400 }
    );
  }

  // Check for duplicate answer
  const [existingAnswer] = await db
    .select({ id: participantAnswer.id })
    .from(participantAnswer)
    .where(
      and(
        eq(participantAnswer.participantId, participant.id),
        eq(participantAnswer.stepId, currentStep.id)
      )
    );

  if (existingAnswer) {
    return Response.json({ error: "Already answered" }, { status: 409 });
  }

  const choices = currentStep.choices ?? [];
  const isCorrect = choices[choiceIndex]?.isCorrect ?? false;
  const answeredAt = new Date();

  const score = computeScore(
    isCorrect,
    currentStep.timeLimitSeconds,
    answeredAt.getTime(),
    gs.stepStartedAt?.getTime() ?? answeredAt.getTime()
  );

  await db.insert(participantAnswer).values({
    participantId: participant.id,
    stepId: currentStep.id,
    choiceIndex,
    isCorrect,
    answeredAt,
    score,
  });

  if (score > 0) {
    await db
      .update(gameParticipant)
      .set({ totalScore: participant.totalScore + score })
      .where(eq(gameParticipant.id, participant.id));
  }

  // Count answers for this step to update host
  const [answerCountRow] = await db
    .select({ value: count() })
    .from(participantAnswer)
    .where(eq(participantAnswer.stepId, currentStep.id));

  const [totalCountRow] = await db
    .select({ value: count() })
    .from(gameParticipant)
    .where(eq(gameParticipant.sessionId, sessionId));

  publish(sessionId, {
    type: "answer_received",
    data: {
      answered: answerCountRow?.value ?? 0,
      total: totalCountRow?.value ?? 0,
    },
  });

  return Response.json({ received: true });
}
