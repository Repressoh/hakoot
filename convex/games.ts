import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }

    return await ctx.db.insert("games", {
      title: args.title,
      description: args.description,
      createdById: userId,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    gameId: v.id("games"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
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
      updates.title = args.title;
    }
    if (args.description !== undefined) {
      updates.description = args.description;
    }

    await ctx.db.patch(args.gameId, updates);
    return args.gameId;
  },
});

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

    // Delete all steps
    const steps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    await Promise.all(steps.map((s) => ctx.db.delete(s._id)));

    // Delete all sessions and their participants/answers
    const sessions = await ctx.db
      .query("gameSessions")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    for (const session of sessions) {
      const participants = await ctx.db
        .query("gameParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const p of participants) {
        const answers = await ctx.db
          .query("participantAnswers")
          .withIndex("by_participant", (q) => q.eq("participantId", p._id))
          .collect();
        await Promise.all(answers.map((a) => ctx.db.delete(a._id)));
        await ctx.db.delete(p._id);
      }
      await ctx.db.delete(session._id);
    }

    await ctx.db.delete(args.gameId);
    return null;
  },
});
