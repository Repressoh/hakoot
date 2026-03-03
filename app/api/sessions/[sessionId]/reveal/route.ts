import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameParticipant, gameSession, gameStep, participantAnswer } from "@/lib/db/schema";
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

  const correctIndex = currentStep.choices?.findIndex((c) => c.isCorrect) ?? -1;

  // Get participant scores for this step
  const participants = await db
    .select({
      id: gameParticipant.id,
      name: gameParticipant.name,
      totalScore: gameParticipant.totalScore,
    })
    .from(gameParticipant)
    .where(eq(gameParticipant.sessionId, sessionId))
    .orderBy(gameParticipant.totalScore);

  const leaderboardData = participants
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 10)
    .map((p, i) => ({ rank: i + 1, name: p.name, score: p.totalScore }));

  // If already revealed (e.g. auto-revealed), re-publish the event
  // so the host UI receives it and return success (idempotent)
  if (gs.answerRevealed) {
    publish(sessionId, {
      type: "answer_revealed",
      data: { correctIndex, leaderboard: leaderboardData },
    });
    return Response.json({ correctIndex });
  }

  // Apply step scores to participant totals
  const stepAnswers = await db
    .select({ participantId: participantAnswer.participantId, score: participantAnswer.score })
    .from(participantAnswer)
    .where(eq(participantAnswer.stepId, currentStep.id));

  await Promise.all(
    stepAnswers
      .filter((a) => a.score > 0)
      .map((a) =>
        db
          .update(gameParticipant)
          .set({ totalScore: sql`${gameParticipant.totalScore} + ${a.score}` })
          .where(eq(gameParticipant.id, a.participantId))
      )
  );

  // Re-fetch participants with updated scores for the leaderboard
  const updatedParticipants = await db
    .select({
      id: gameParticipant.id,
      name: gameParticipant.name,
      totalScore: gameParticipant.totalScore,
    })
    .from(gameParticipant)
    .where(eq(gameParticipant.sessionId, sessionId));

  const finalLeaderboardData = [...updatedParticipants]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 10)
    .map((p, i) => ({ rank: i + 1, name: p.name, score: p.totalScore }));

  await db
    .update(gameSession)
    .set({ answerRevealed: true, updatedAt: new Date() })
    .where(eq(gameSession.id, sessionId));

  publish(sessionId, {
    type: "answer_revealed",
    data: { correctIndex, leaderboard: finalLeaderboardData },
  });

  return Response.json({ correctIndex });
}
