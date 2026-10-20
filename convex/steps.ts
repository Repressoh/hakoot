import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { getImageView, MAX_IMAGE_ALT_LENGTH, releaseImage } from "./images";
import { checkRateLimit } from "./sessions";

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
      linesText: v.optional(v.string()),
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

/** Throws unless the current user owns the game of `stepId`; returns the step and the user id. */
async function requireStepOwner(
  ctx: QueryCtx | MutationCtx,
  stepId: Id<"gameSteps">
) {
  const step = await ctx.db.get(stepId);
  if (!step) {
    throw new ConvexError("Not found");
  }
  const { userId } = await requireGameOwner(ctx, step.gameId);
  return { step, userId };
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

    const image = await getImageView(ctx, step.image);
    return {
      ...step,
      // With the file's id, so alt text edits name the image they describe.
      image:
        image && step.image
          ? { ...image, storageId: step.image.storageId }
          : null,
    };
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
    const { step } = await requireStepOwner(ctx, args.stepId);

    const updates: Partial<Doc<"gameSteps">> = {};
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
    const { step } = await requireStepOwner(ctx, args.stepId);

    const updates: Partial<Doc<"gameSteps">> = {};
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

    // Its answers, from every session of the game (including those started
    // from its share link), can be too many for one transaction.
    await ctx.db.delete(args.stepId);
    await ctx.scheduler.runAfter(0, internal.steps.deleteStepAnswers, {
      stepId: args.stepId,
    });
    if (step.image) {
      await releaseImage(ctx, step.image.storageId);
    }

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

/**
 * Check that the current user can upload an image for the step `stepId`, and count the upload
 * against their rate limit. Called by the upload route before it stores the file.
 */
export const prepareImageUpload = internalMutation({
  // A string from the upload URL, so a malformed id is "Not found" too.
  args: { stepId: v.string() },
  handler: async (ctx, args) => {
    const stepId = ctx.db.normalizeId("gameSteps", args.stepId);
    if (!stepId) {
      throw new ConvexError("Not found");
    }
    const { userId } = await requireStepOwner(ctx, stepId);
    await checkRateLimit(ctx, `user:${userId}`, "uploadImage");
    return stepId;
  },
});

/**
 * Show the stored file `storageId` as the step's image, in place of any image it had, which is
 * deleted unless another step shows it. The new image starts without alt text.
 */
export const attachImage = internalMutation({
  args: {
    height: v.number(),
    stepId: v.id("gameSteps"),
    storageId: v.id("_storage"),
    width: v.number(),
  },
  handler: async (ctx, args) => {
    const { step } = await requireStepOwner(ctx, args.stepId);

    await ctx.db.patch(args.stepId, {
      image: {
        height: args.height,
        storageId: args.storageId,
        width: args.width,
      },
    });
    await ctx.db.patch(step.gameId, { updatedAt: Date.now() });
    if (step.image && step.image.storageId !== args.storageId) {
      await releaseImage(ctx, step.image.storageId);
    }
    return null;
  },
});

/**
 * Set the alt text of the step's image, if it still shows the file `storageId`: a save made for
 * an image since replaced, say from another tab, is dropped instead of describing the new one.
 */
export const setImageAlt = mutation({
  args: {
    alt: v.string(),
    stepId: v.id("gameSteps"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const { step } = await requireStepOwner(ctx, args.stepId);
    if (step.image?.storageId !== args.storageId) {
      return null;
    }

    await ctx.db.patch(args.stepId, {
      image: {
        ...step.image,
        alt: sanitizeInput(args.alt, MAX_IMAGE_ALT_LENGTH) || undefined,
      },
    });
    await ctx.db.patch(step.gameId, { updatedAt: Date.now() });
    return null;
  },
});

/** Remove a step's image; its file is deleted unless another step shows it. */
export const removeImage = mutation({
  args: { stepId: v.id("gameSteps") },
  handler: async (ctx, args) => {
    const { step } = await requireStepOwner(ctx, args.stepId);
    if (!step.image) {
      return null;
    }

    await ctx.db.patch(args.stepId, { image: undefined });
    await ctx.db.patch(step.gameId, { updatedAt: Date.now() });
    await releaseImage(ctx, step.image.storageId);
    return null;
  },
});

/** Answers `deleteStepAnswers` deletes per run. */
const ANSWER_BATCH_SIZE = 500;

/** Delete a batch of a deleted step's answers, then schedule itself until none are left. */
export const deleteStepAnswers = internalMutation({
  args: { stepId: v.id("gameSteps") },
  handler: async (ctx, { stepId }) => {
    const answers = await ctx.db
      .query("participantAnswers")
      .withIndex("by_step", (q) => q.eq("stepId", stepId))
      .take(ANSWER_BATCH_SIZE);
    await Promise.all(answers.map((answer) => ctx.db.delete(answer._id)));
    if (answers.length === ANSWER_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.steps.deleteStepAnswers, {
        stepId,
      });
    }
    return null;
  },
});
