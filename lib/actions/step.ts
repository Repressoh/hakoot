"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { CodeBlock, QuizChoice } from "@/lib/db/schema";
import { game, gameStep } from "@/lib/db/schema";
import { requireAuth } from "./auth";

async function assertGameOwner(gameId: string, userId: string) {
  const [g] = await db
    .select({ id: game.id })
    .from(game)
    .where(and(eq(game.id, gameId), eq(game.createdById, userId)));
  if (!g) {
    throw new Error("Game not found or not authorized");
  }
  return g;
}

export async function getStep(stepId: string) {
  const session = await requireAuth();
  const [step] = await db
    .select()
    .from(gameStep)
    .where(eq(gameStep.id, stepId));
  if (!step) {
    return null;
  }
  await assertGameOwner(step.gameId, session.user.id);
  return step;
}

export async function createTheoryStep(
  gameId: string,
  data: { markdownContent: string; codeBlock?: CodeBlock }
) {
  const session = await requireAuth();
  await assertGameOwner(gameId, session.user.id);

  // Get next order value
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${gameStep.order}), -1)` })
    .from(gameStep)
    .where(eq(gameStep.gameId, gameId));

  const [step] = await db
    .insert(gameStep)
    .values({
      gameId,
      type: "theory",
      order: max + 1,
      markdownContent: data.markdownContent,
      codeBlock: data.codeBlock ?? null,
    })
    .returning();

  await db
    .update(game)
    .set({ updatedAt: new Date() })
    .where(eq(game.id, gameId));

  revalidatePath("/[locale]/(dashboard)/games/[gameId]", "page");
  return step;
}

export async function createQuizStep(
  gameId: string,
  data: {
    question: string;
    choices: QuizChoice[];
    timeLimitSeconds?: number;
  }
) {
  const session = await requireAuth();
  await assertGameOwner(gameId, session.user.id);

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${gameStep.order}), -1)` })
    .from(gameStep)
    .where(eq(gameStep.gameId, gameId));

  const [step] = await db
    .insert(gameStep)
    .values({
      gameId,
      type: "quiz",
      order: max + 1,
      question: data.question,
      choices: data.choices,
      timeLimitSeconds: data.timeLimitSeconds ?? null,
    })
    .returning();

  await db
    .update(game)
    .set({ updatedAt: new Date() })
    .where(eq(game.id, gameId));

  revalidatePath("/[locale]/(dashboard)/games/[gameId]", "page");
  return step;
}

export async function updateTheoryStep(
  stepId: string,
  data: { markdownContent: string; codeBlock?: CodeBlock | null }
) {
  const session = await requireAuth();
  const [existing] = await db
    .select()
    .from(gameStep)
    .where(eq(gameStep.id, stepId));
  if (!existing) {
    throw new Error("Step not found");
  }
  await assertGameOwner(existing.gameId, session.user.id);

  const [step] = await db
    .update(gameStep)
    .set({
      markdownContent: data.markdownContent,
      codeBlock: data.codeBlock ?? null,
      updatedAt: new Date(),
    })
    .where(eq(gameStep.id, stepId))
    .returning();

  revalidatePath("/[locale]/(dashboard)/games/[gameId]/steps/[stepId]", "page");
  return step;
}

export async function updateQuizStep(
  stepId: string,
  data: {
    question: string;
    choices: QuizChoice[];
    timeLimitSeconds?: number | null;
  }
) {
  const session = await requireAuth();
  const [existing] = await db
    .select()
    .from(gameStep)
    .where(eq(gameStep.id, stepId));
  if (!existing) {
    throw new Error("Step not found");
  }
  await assertGameOwner(existing.gameId, session.user.id);

  const [step] = await db
    .update(gameStep)
    .set({
      question: data.question,
      choices: data.choices,
      timeLimitSeconds: data.timeLimitSeconds ?? null,
      updatedAt: new Date(),
    })
    .where(eq(gameStep.id, stepId))
    .returning();

  revalidatePath("/[locale]/(dashboard)/games/[gameId]/steps/[stepId]", "page");
  return step;
}

export async function deleteStep(stepId: string) {
  const session = await requireAuth();
  const [existing] = await db
    .select()
    .from(gameStep)
    .where(eq(gameStep.id, stepId));
  if (!existing) {
    throw new Error("Step not found");
  }
  await assertGameOwner(existing.gameId, session.user.id);

  await db.delete(gameStep).where(eq(gameStep.id, stepId));

  // Re-number remaining steps
  const remaining = await db
    .select({ id: gameStep.id })
    .from(gameStep)
    .where(eq(gameStep.gameId, existing.gameId))
    .orderBy(gameStep.order);

  for (let i = 0; i < remaining.length; i++) {
    await db
      .update(gameStep)
      .set({ order: i })
      .where(eq(gameStep.id, remaining[i].id));
  }

  await db
    .update(game)
    .set({ updatedAt: new Date() })
    .where(eq(game.id, existing.gameId));

  revalidatePath("/[locale]/(dashboard)/games/[gameId]", "page");
}

export async function reorderSteps(gameId: string, orderedIds: string[]) {
  const session = await requireAuth();
  await assertGameOwner(gameId, session.user.id);

  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(gameStep)
      .set({ order: i })
      .where(and(eq(gameStep.id, orderedIds[i]), eq(gameStep.gameId, gameId)));
  }

  await db
    .update(game)
    .set({ updatedAt: new Date() })
    .where(eq(game.id, gameId));

  revalidatePath("/[locale]/(dashboard)/games/[gameId]", "page");
}

export async function moveStep(stepId: string, direction: "up" | "down") {
  const session = await requireAuth();
  const [step] = await db
    .select()
    .from(gameStep)
    .where(eq(gameStep.id, stepId));
  if (!step) {
    throw new Error("Step not found");
  }
  await assertGameOwner(step.gameId, session.user.id);

  const targetOrder = direction === "up" ? step.order - 1 : step.order + 1;

  const [sibling] = await db
    .select()
    .from(gameStep)
    .where(
      and(eq(gameStep.gameId, step.gameId), eq(gameStep.order, targetOrder))
    );

  if (!sibling) {
    return; // Already at boundary
  }

  await db
    .update(gameStep)
    .set({ order: targetOrder })
    .where(eq(gameStep.id, stepId));

  await db
    .update(gameStep)
    .set({ order: step.order })
    .where(eq(gameStep.id, sibling.id));

  revalidatePath("/[locale]/(dashboard)/games/[gameId]", "page");
}
