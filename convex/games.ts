import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import { releaseImage } from "./images";
import { deleteSession } from "./sessions";

/** Sanitize user input */
function sanitizeInput(input: string, maxLength = 500): string {
  return input.trim().replace(/[<>]/g, "").trim().slice(0, maxLength);
}

/** Sessions deleted per run of `deleteGameData` (each schedules the deletion of its rows). */
const SESSION_BATCH_SIZE = 100;
/** Steps deleted per run of `deleteGameData`, once its sessions are gone. */
const STEP_BATCH_SIZE = 10;
/** Most answers deleted per step per run of `deleteGameData`. */
const STEP_ANSWER_BUDGET = 200;

/**
 * Delete part of a deleted game's data in a bounded batch: some of its sessions (their players,
 * presence rows and answers follow in the background), then, once those are gone, its steps with
 * any answers left by step. Answers saved without a session id are only found by step.
 *
 * @returns Whether nothing is left.
 */
async function deleteGameBatch(
  ctx: MutationCtx,
  gameId: Id<"games">
): Promise<boolean> {
  const sessions = await ctx.db
    .query("gameSessions")
    .withIndex("by_game", (q) => q.eq("gameId", gameId))
    .take(SESSION_BATCH_SIZE);
  if (sessions.length > 0) {
    await Promise.all(
      sessions.map((session) => deleteSession(ctx, session._id))
    );
    return false;
  }

  const steps = await ctx.db
    .query("gameSteps")
    .withIndex("by_game", (q) => q.eq("gameId", gameId))
    .take(STEP_BATCH_SIZE);
  const deletedImages = new Set<Id<"_storage">>();
  await Promise.all(
    steps.map(async (step) => {
      const answers = await ctx.db
        .query("participantAnswers")
        .withIndex("by_step", (q) => q.eq("stepId", step._id))
        .take(STEP_ANSWER_BUDGET);
      await Promise.all(answers.map((answer) => ctx.db.delete(answer._id)));
      if (answers.length < STEP_ANSWER_BUDGET) {
        await ctx.db.delete(step._id);
        if (step.image) {
          deletedImages.add(step.image.storageId);
        }
      }
    })
  );
  // Once every deleted step is gone, so a file two of them showed is seen
  // as unused.
  await Promise.all(
    [...deletedImages].map((storageId) => releaseImage(ctx, storageId))
  );
  return steps.length === 0;
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

/**
 * A game with all its steps.
 *
 * @deprecated Replaced by `getEditorView`, which sends a short preview of each step instead of its
 * full content. Kept so editors opened before the switch keep working; remove in a later release.
 */
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

/**
 * A game with a short summary of each step, for the editor's step list. Full step content is
 * loaded by the step editor.
 */
export const getEditorView = query({
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
      .withIndex("by_game_and_order", (q) => q.eq("gameId", game._id))
      .collect();

    const shareEnabled = game.shareEnabled === true;
    return {
      _id: game._id,
      description: game.description,
      shareEnabled,
      // Only while sharing is on: there is no link to show otherwise.
      shareToken: shareEnabled ? (game.shareToken ?? null) : null,
      steps: steps.map((step) => ({
        _id: step._id,
        preview:
          step.type === "theory"
            ? (step.markdownContent ?? "").slice(0, 60)
            : (step.question ?? "").slice(0, 200),
        type: step.type,
      })),
      title: game.title,
    };
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

    // The game is gone at once; its sessions, players, answers and steps
    // follow in the background, a batch at a time.
    await ctx.db.delete(args.gameId);
    await ctx.scheduler.runAfter(0, internal.games.deleteGameData, {
      gameId: args.gameId,
    });
    return null;
  },
});

/**
 * Delete a game and everything under it: steps, sessions, participants and their answers. Runs a
 * bounded batch, then schedules itself until nothing is left, so a game with any number of
 * sessions can be deleted. Scheduled by `remove` and, per game, by account deletion.
 */
export const deleteGameData = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    // Already gone when the owner deleted it.
    if (await ctx.db.get(gameId)) {
      await ctx.db.delete(gameId);
    }
    if (!(await deleteGameBatch(ctx, gameId))) {
      await ctx.scheduler.runAfter(0, internal.games.deleteGameData, {
        gameId,
      });
    }
    return null;
  },
});
