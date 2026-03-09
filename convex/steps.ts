import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

const codeBlockValidator = v.object({
  code: v.string(),
  language: v.string(),
  annotations: v.array(
    v.object({
      label: v.string(),
      explanation: v.string(),
      lines: v.array(v.number()),
    })
  ),
});

async function requireGameOwner(ctx: any, gameId: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Unauthorized");
  }
  const game = await ctx.db.get(gameId);
  if (!game || game.createdById !== userId) {
    throw new ConvexError("Not found");
  }
  return { userId, game };
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

export const createTheory = mutation({
  args: {
    gameId: v.id("games"),
    markdownContent: v.optional(v.string()),
    codeBlock: v.optional(codeBlockValidator),
  },
  handler: async (ctx, args) => {
    await requireGameOwner(ctx, args.gameId);

    const existingSteps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    const order = existingSteps.length;

    const stepId = await ctx.db.insert("gameSteps", {
      gameId: args.gameId,
      order,
      type: "theory",
      markdownContent: args.markdownContent ?? "",
      codeBlock: args.codeBlock,
    });

    await ctx.db.patch(args.gameId, { updatedAt: Date.now() });
    return stepId;
  },
});

export const createQuiz = mutation({
  args: {
    gameId: v.id("games"),
    question: v.optional(v.string()),
    choices: v.optional(
      v.array(v.object({ text: v.string(), isCorrect: v.boolean() }))
    ),
    timeLimitSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireGameOwner(ctx, args.gameId);

    const existingSteps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    const order = existingSteps.length;

    const stepId = await ctx.db.insert("gameSteps", {
      gameId: args.gameId,
      order,
      type: "quiz",
      question: args.question ?? "",
      choices: args.choices ?? [
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ],
      timeLimitSeconds: args.timeLimitSeconds,
    });

    await ctx.db.patch(args.gameId, { updatedAt: Date.now() });
    return stepId;
  },
});

export const updateTheory = mutation({
  args: {
    stepId: v.id("gameSteps"),
    markdownContent: v.optional(v.string()),
    codeBlock: v.optional(v.union(codeBlockValidator, v.null())),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new ConvexError("Not found");
    }
    await requireGameOwner(ctx, step.gameId);

    const updates: Record<string, unknown> = {};
    if (args.markdownContent !== undefined) {
      updates.markdownContent = args.markdownContent;
    }
    if (args.codeBlock !== undefined) {
      updates.codeBlock = args.codeBlock ?? undefined;
    }

    await ctx.db.patch(args.stepId, updates);
    await ctx.db.patch(step.gameId, { updatedAt: Date.now() });
    return null;
  },
});

export const updateQuiz = mutation({
  args: {
    stepId: v.id("gameSteps"),
    question: v.optional(v.string()),
    choices: v.optional(
      v.array(v.object({ text: v.string(), isCorrect: v.boolean() }))
    ),
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
      updates.question = args.question;
    }
    if (args.choices !== undefined) {
      updates.choices = args.choices;
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

export const reorder = mutation({
  args: {
    gameId: v.id("games"),
    orderedIds: v.array(v.id("gameSteps")),
  },
  handler: async (ctx, args) => {
    await requireGameOwner(ctx, args.gameId);

    await Promise.all(
      args.orderedIds.map((id, i) => ctx.db.patch(id, { order: i }))
    );

    await ctx.db.patch(args.gameId, { updatedAt: Date.now() });
    return null;
  },
});

export const move = mutation({
  args: {
    stepId: v.id("gameSteps"),
    direction: v.union(v.literal("up"), v.literal("down")),
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
