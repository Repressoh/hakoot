"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  game,
  gameParticipant,
  gameSession,
  gameStep,
  participantAnswer,
} from "@/lib/db/schema";
import { generateInviteCode } from "@/lib/utils";
import { requireAuth } from "./auth";

export async function createSession(gameId: string) {
  const authSession = await requireAuth();

  const [g] = await db
    .select()
    .from(game)
    .where(and(eq(game.id, gameId), eq(game.createdById, authSession.user.id)));

  if (!g) {
    throw new Error("Game not found");
  }

  const inviteCode = generateInviteCode();

  const [gs] = await db
    .insert(gameSession)
    .values({
      gameId,
      hostId: authSession.user.id,
      inviteCode,
      status: "waiting",
      currentStepIndex: -1,
    })
    .returning();

  revalidatePath("/[locale]/(dashboard)/games/[gameId]/sessions", "page");
  return gs;
}

export async function getSessionsForGame(gameId: string) {
  const authSession = await requireAuth();

  const [g] = await db
    .select({ id: game.id })
    .from(game)
    .where(and(eq(game.id, gameId), eq(game.createdById, authSession.user.id)));

  if (!g) {
    return [];
  }

  return db
    .select()
    .from(gameSession)
    .where(eq(gameSession.gameId, gameId))
    .orderBy(desc(gameSession.createdAt));
}

export async function getSessionForHost(sessionId: string) {
  const authSession = await requireAuth();

  const [gs] = await db
    .select()
    .from(gameSession)
    .where(
      and(
        eq(gameSession.id, sessionId),
        eq(gameSession.hostId, authSession.user.id)
      )
    );

  return gs ?? null;
}

export async function getSessionResults(sessionId: string) {
  const authSession = await requireAuth();

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
    return null;
  }

  const participants = await db
    .select()
    .from(gameParticipant)
    .where(eq(gameParticipant.sessionId, sessionId))
    .orderBy(desc(gameParticipant.totalScore));

  const answers = await db
    .select({
      id: participantAnswer.id,
      participantId: participantAnswer.participantId,
      stepId: participantAnswer.stepId,
      choiceIndex: participantAnswer.choiceIndex,
      isCorrect: participantAnswer.isCorrect,
      answeredAt: participantAnswer.answeredAt,
      score: participantAnswer.score,
    })
    .from(participantAnswer)
    .innerJoin(
      gameParticipant,
      eq(participantAnswer.participantId, gameParticipant.id)
    )
    .where(eq(gameParticipant.sessionId, sessionId));

  const steps = await db
    .select()
    .from(gameStep)
    .where(eq(gameStep.gameId, gs.gameId))
    .orderBy(gameStep.order);

  return { session: gs, participants, answers, steps };
}
