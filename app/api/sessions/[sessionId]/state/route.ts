import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  game,
  gameParticipant,
  gameSession,
  gameStep,
  participantAnswer,
} from "@/lib/db/schema";

export async function GET(
  _req: Request,
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

  const [gs] = await db
    .select()
    .from(gameSession)
    .where(eq(gameSession.id, sessionId));

  if (!gs) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const [g] = await db
    .select({ title: game.title })
    .from(game)
    .where(eq(game.id, gs.gameId));

  const steps = await db
    .select()
    .from(gameStep)
    .where(eq(gameStep.gameId, gs.gameId))
    .orderBy(gameStep.order);

  const answers = await db
    .select()
    .from(participantAnswer)
    .where(eq(participantAnswer.participantId, participant.id));

  const currentStep =
    gs.currentStepIndex >= 0 ? steps[gs.currentStepIndex] : null;

  const currentAnswer = currentStep
    ? answers.find((a) => a.stepId === currentStep.id)
    : null;

  return Response.json({
    participant: {
      id: participant.id,
      name: participant.name,
      totalScore: participant.totalScore,
    },
    session: {
      id: gs.id,
      status: gs.status,
      currentStepIndex: gs.currentStepIndex,
      stepStartedAt: gs.stepStartedAt?.toISOString() ?? null,
      answerRevealed: gs.answerRevealed,
      totalSteps: steps.length,
      gameTitle: g?.title ?? "",
    },
    currentStep: currentStep
      ? {
          id: currentStep.id,
          type: currentStep.type,
          order: currentStep.order,
          markdownContent: currentStep.markdownContent,
          codeBlock: currentStep.codeBlock,
          question: currentStep.question,
          choices: currentStep.choices,
          timeLimitSeconds: currentStep.timeLimitSeconds,
        }
      : null,
    currentAnswer: currentAnswer
      ? {
          choiceIndex: currentAnswer.choiceIndex,
          isCorrect: currentAnswer.isCorrect,
          score: currentAnswer.score,
        }
      : null,
  });
}
