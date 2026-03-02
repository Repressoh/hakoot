import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameParticipant, gameSession, gameStep } from "@/lib/db/schema";
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

  if (gs.answerRevealed) {
    return Response.json({ error: "Already revealed" }, { status: 400 });
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

  await db
    .update(gameSession)
    .set({ answerRevealed: true, updatedAt: new Date() })
    .where(eq(gameSession.id, sessionId));

  publish(sessionId, {
    type: "answer_revealed",
    data: {
      correctIndex,
      leaderboard: participants
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10)
        .map((p, i) => ({ rank: i + 1, name: p.name, score: p.totalScore })),
    },
  });

  return Response.json({ correctIndex });
}
