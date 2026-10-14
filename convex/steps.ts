import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

/** Sanitize user input */
function sanitizeInput(input: string, maxLength = 5000): string {
  return input.trim().slice(0, maxLength);
}

const codeBlockValidator = v.object({
  annotations: v.array(
    v.object({
      explanation: v.string(),
      label: v.string(),
      lines: v.array(v.number()),
    })
  ),
  code: v.string(),
  language: v.string(),
});

/** Throws unless the current user owns `gameId`; returns the game and the user id. */
async function requireGameOwner(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<"games">
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Unauthorized");
  }
  const game = await ctx.db.get(gameId);
  if (!game || game.createdById !== userId) {
    throw new ConvexError("Not found");
  }
  return { game, userId };
}

export const get = query({
  args: { stepId: v.id("gameSteps") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const step = await ctx.db.get(args.stepId);
    if (!step) {
      return null;
    }

    const game = await ctx.db.get(step.gameId);
    if (!game || game.createdById !== userId) {
      return null;
    }

    return step;
  },
});

/** Append a theory step to one of the current user's games. */
export const createTheory = mutation({
  args: {
    codeBlock: v.optional(codeBlockValidator),
    gameId: v.id("games"),
    markdownContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireGameOwner(ctx, args.gameId);

    const existingSteps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    const order = existingSteps.length;

    const stepId = await ctx.db.insert("gameSteps", {
      codeBlock: args.codeBlock,
      gameId: args.gameId,
      markdownContent: args.markdownContent
        ? sanitizeInput(args.markdownContent, 10_000)
        : "",
      order,
      type: "theory",
    });

    await ctx.db.patch(args.gameId, { updatedAt: Date.now() });
    return stepId;
  },
});

/** Append a quiz step to one of the current user's games. */
export const createQuiz = mutation({
  args: {
    choices: v.optional(
      v.array(v.object({ isCorrect: v.boolean(), text: v.string() }))
    ),
    gameId: v.id("games"),
    question: v.optional(v.string()),
    timeLimitSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireGameOwner(ctx, args.gameId);

    const existingSteps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    const order = existingSteps.length;

    const sanitizedChoices = args.choices?.map((choice) => ({
      isCorrect: choice.isCorrect,
      text: sanitizeInput(choice.text, 500),
    }));

    const stepId = await ctx.db.insert("gameSteps", {
      choices: sanitizedChoices ?? [
        { isCorrect: false, text: "" },
        { isCorrect: false, text: "" },
        { isCorrect: false, text: "" },
        { isCorrect: false, text: "" },
      ],
      gameId: args.gameId,
      order,
      question: args.question ? sanitizeInput(args.question, 1000) : "",
      timeLimitSeconds: args.timeLimitSeconds,
      type: "quiz",
    });

    await ctx.db.patch(args.gameId, { updatedAt: Date.now() });
    return stepId;
  },
});

/** Update a theory step's markdown and code block (`codeBlock: null` removes it). */
export const updateTheory = mutation({
  args: {
    codeBlock: v.optional(v.union(codeBlockValidator, v.null())),
    markdownContent: v.optional(v.string()),
    stepId: v.id("gameSteps"),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new ConvexError("Not found");
    }
    await requireGameOwner(ctx, step.gameId);

    const updates: Record<string, unknown> = {};
    if (args.markdownContent !== undefined) {
      updates.markdownContent = sanitizeInput(args.markdownContent, 10_000);
    }
    if (args.codeBlock !== undefined) {
      updates.codeBlock = args.codeBlock ?? undefined;
    }

    await ctx.db.patch(args.stepId, updates);
    await ctx.db.patch(step.gameId, { updatedAt: Date.now() });
    return null;
  },
});

/**
 * Update a quiz step's question, choices and time limit (`timeLimitSeconds: null` removes the
 * limit).
 */
export const updateQuiz = mutation({
  args: {
    choices: v.optional(
      v.array(v.object({ isCorrect: v.boolean(), text: v.string() }))
    ),
    question: v.optional(v.string()),
    stepId: v.id("gameSteps"),
    timeLimitSeconds: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new ConvexError("Not found");
    }
    await requireGameOwner(ctx, step.gameId);

    const updates: Record<string, unknown> = {};
    if (args.question !== undefined) {
      updates.question = sanitizeInput(args.question, 1000);
    }
    if (args.choices !== undefined) {
      updates.choices = args.choices.map((choice) => ({
        isCorrect: choice.isCorrect,
        text: sanitizeInput(choice.text, 500),
      }));
    }
    if (args.timeLimitSeconds !== undefined) {
      updates.timeLimitSeconds =
        args.timeLimitSeconds === null ? undefined : args.timeLimitSeconds;
    }

    await ctx.db.patch(args.stepId, updates);
    await ctx.db.patch(step.gameId, { updatedAt: Date.now() });
    return null;
  },
});

export const remove = mutation({
  args: { stepId: v.id("gameSteps") },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new ConvexError("Not found");
    }
    await requireGameOwner(ctx, step.gameId);

    // Delete answers for this step
    const answers = await ctx.db
      .query("participantAnswers")
      .withIndex("by_step", (q) => q.eq("stepId", args.stepId))
      .collect();
    await Promise.all(answers.map((a) => ctx.db.delete(a._id)));

    await ctx.db.delete(args.stepId);

    // Re-number remaining steps
    const remaining = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", step.gameId))
      .collect();
    remaining.sort((a, b) => a.order - b.order);
    await Promise.all(
      remaining.map((s, i) => ctx.db.patch(s._id, { order: i }))
    );

    await ctx.db.patch(step.gameId, { updatedAt: Date.now() });
    return null;
  },
});

/** Set the order of a game's steps to match `orderedIds`, which must all belong to that game. */
export const reorder = mutation({
  args: {
    gameId: v.id("games"),
    orderedIds: v.array(v.id("gameSteps")),
  },
  handler: async (ctx, args) => {
    await requireGameOwner(ctx, args.gameId);

    // Owning this game must not allow reordering another game's steps
    const steps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    const gameStepIds = new Set(steps.map((step) => step._id));
    if (!args.orderedIds.every((id) => gameStepIds.has(id))) {
      throw new ConvexError("Not found");
    }

    await Promise.all(
      args.orderedIds.map((id, i) => ctx.db.patch(id, { order: i }))
    );

    await ctx.db.patch(args.gameId, { updatedAt: Date.now() });
    return null;
  },
});

/** Swap a step with its neighbor above or below. */
export const move = mutation({
  args: {
    direction: v.union(v.literal("up"), v.literal("down")),
    stepId: v.id("gameSteps"),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new ConvexError("Not found");
    }
    await requireGameOwner(ctx, step.gameId);

    const allSteps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", step.gameId))
      .collect();
    allSteps.sort((a, b) => a.order - b.order);

    const idx = allSteps.findIndex((s) => s._id === args.stepId);
    const swapIdx = args.direction === "up" ? idx - 1 : idx + 1;

    if (swapIdx < 0 || swapIdx >= allSteps.length) {
      return null;
    }

    const other = allSteps[swapIdx];
    await ctx.db.patch(args.stepId, { order: other.order });
    await ctx.db.patch(other._id, { order: step.order });
    await ctx.db.patch(step.gameId, { updatedAt: Date.now() });

    return null;
  },
});
