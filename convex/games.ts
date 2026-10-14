import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";

/** Sanitize user input */
function sanitizeInput(input: string, maxLength = 500): string {
  return input.trim().replace(/[<>]/g, "").trim().slice(0, maxLength);
}

/** Delete a game and everything under it: steps, sessions, participants and their answers. */
export async function deleteGameCascade(
  ctx: MutationCtx,
  gameId: Id<"games">
): Promise<void> {
  const [steps, sessions] = await Promise.all([
    ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect(),
    ctx.db
      .query("gameSessions")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect(),
  ]);

  const participants = (
    await Promise.all(
      sessions.map((session) =>
        ctx.db
          .query("gameParticipants")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect()
      )
    )
  ).flat();

  // Find answers by step as well as by participant: cleanupExpiredTokens
  // deletes expired players but keeps their answers, so some answers have no
  // participant left. The Set avoids deleting an answer twice.
  const answerLists = await Promise.all([
    ...steps.map((step) =>
      ctx.db
        .query("participantAnswers")
        .withIndex("by_step", (q) => q.eq("stepId", step._id))
        .collect()
    ),
    ...participants.map((p) =>
      ctx.db
        .query("participantAnswers")
        .withIndex("by_participant", (q) => q.eq("participantId", p._id))
        .collect()
    ),
  ]);
  const answerIds = new Set(answerLists.flat().map((answer) => answer._id));

  await Promise.all([
    ...Array.from(answerIds, (id) => ctx.db.delete(id)),
    ...participants.map((p) => ctx.db.delete(p._id)),
    ...sessions.map((session) => ctx.db.delete(session._id)),
    ...steps.map((step) => ctx.db.delete(step._id)),
  ]);

  await ctx.db.delete(gameId);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const games = await ctx.db
      .query("games")
      .withIndex("by_creator", (q) => q.eq("createdById", userId))
      .order("desc")
      .collect();

    const result = await Promise.all(
      games.map(async (game) => {
        const steps = await ctx.db
          .query("gameSteps")
          .withIndex("by_game", (q) => q.eq("gameId", game._id))
          .collect();
        return {
          ...game,
          stepCount: steps.length,
        };
      })
    );

    return result;
  },
});

export const get = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const game = await ctx.db.get(args.gameId);
    if (!game || game.createdById !== userId) {
      return null;
    }

    return game;
  },
});

export const getWithSteps = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const game = await ctx.db.get(args.gameId);
    if (!game || game.createdById !== userId) {
      return null;
    }

    const steps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    // Sort by order field
    steps.sort((a, b) => a.order - b.order);

    return { ...game, steps };
  },
});

/** Create a game owned by the current user. */
export const create = mutation({
  args: {
    description: v.optional(v.string()),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }

    const sanitizedTitle = sanitizeInput(args.title, 200);
    if (!sanitizedTitle) {
      throw new ConvexError("Invalid title");
    }

    return await ctx.db.insert("games", {
      createdById: userId,
      description: args.description
        ? sanitizeInput(args.description, 1000)
        : undefined,
      title: sanitizedTitle,
      updatedAt: Date.now(),
    });
  },
});

/** Update the title and/or description of one of the current user's games. */
export const update = mutation({
  args: {
    description: v.optional(v.string()),
    gameId: v.id("games"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }

    const game = await ctx.db.get(args.gameId);
    if (!game || game.createdById !== userId) {
      throw new ConvexError("Not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      const sanitizedTitle = sanitizeInput(args.title, 200);
      if (!sanitizedTitle) {
        throw new ConvexError("Invalid title");
      }
      updates.title = sanitizedTitle;
    }
    if (args.description !== undefined) {
      updates.description = sanitizeInput(args.description, 1000);
    }

    await ctx.db.patch(args.gameId, updates);
    return args.gameId;
  },
});

/** Delete one of the current user's games with its steps, sessions, participants and answers. */
export const remove = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }

    const game = await ctx.db.get(args.gameId);
    if (!game || game.createdById !== userId) {
      throw new ConvexError("Not found");
    }

    await deleteGameCascade(ctx, args.gameId);
    return null;
  },
});

/** Deletes one game's data. Scheduled per game by account deletion so each
 * game gets its own transaction (and its own write limits). */
export const deleteGameData = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    // The owner may have deleted it in the meantime.
    if (await ctx.db.get(gameId)) {
      await deleteGameCascade(ctx, gameId);
    }
    return null;
  },
});
