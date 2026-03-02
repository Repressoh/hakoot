"use server";

import { and, count, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { game, gameStep } from "@/lib/db/schema";
import { requireAuth } from "./auth";

export async function getGames() {
  const session = await requireAuth();

  const games = await db
    .select({
      id: game.id,
      title: game.title,
      description: game.description,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      stepCount: count(gameStep.id),
    })
    .from(game)
    .leftJoin(gameStep, eq(gameStep.gameId, game.id))
    .where(eq(game.createdById, session.user.id))
    .groupBy(game.id)
    .orderBy(desc(game.updatedAt));

  return games;
}

export async function getGame(gameId: string) {
  const session = await requireAuth();

  const [g] = await db
    .select()
    .from(game)
    .where(and(eq(game.id, gameId), eq(game.createdById, session.user.id)));

  return g ?? null;
}

export async function getGameWithSteps(gameId: string) {
  const session = await requireAuth();

  const [g] = await db
    .select()
    .from(game)
    .where(and(eq(game.id, gameId), eq(game.createdById, session.user.id)));

  if (!g) {
    return null;
  }

  const steps = await db
    .select()
    .from(gameStep)
    .where(eq(gameStep.gameId, gameId))
    .orderBy(gameStep.order);

  return { ...g, steps };
}

export async function createGame(data: {
  title: string;
  description?: string;
}) {
  const session = await requireAuth();

  const [g] = await db
    .insert(game)
    .values({
      title: data.title,
      description: data.description,
      createdById: session.user.id,
    })
    .returning();

  revalidatePath("/[locale]/(dashboard)/dashboard", "page");
  return g;
}

export async function updateGame(
  gameId: string,
  data: { title?: string; description?: string }
) {
  const session = await requireAuth();

  const [g] = await db
    .update(game)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(game.id, gameId), eq(game.createdById, session.user.id)))
    .returning();

  revalidatePath("/[locale]/(dashboard)/games/[gameId]", "page");
  return g;
}

export async function deleteGame(gameId: string) {
  const session = await requireAuth();

  await db
    .delete(game)
    .where(and(eq(game.id, gameId), eq(game.createdById, session.user.id)));

  revalidatePath("/[locale]/(dashboard)/dashboard", "page");
}
