import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Queries ───────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("emailLists")
      .withIndex("by_creator", (q) => q.eq("createdById", userId))
      .order("desc")
      .collect();
  },
});

export const getWithEntries = query({
  args: { listId: v.id("emailLists") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const list = await ctx.db.get(args.listId);
    if (!list || list.createdById !== userId) {
      return null;
    }

    const entries = await ctx.db
      .query("emailListEntries")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .collect();

    return { ...list, entries };
  },
});

export const listWithEntries = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const lists = await ctx.db
      .query("emailLists")
      .withIndex("by_creator", (q) => q.eq("createdById", userId))
      .order("desc")
      .collect();

    return await Promise.all(
      lists.map(async (list) => {
        const entries = await ctx.db
          .query("emailListEntries")
          .withIndex("by_list", (q) => q.eq("listId", list._id))
          .collect();
        return { ...list, entries };
      })
    );
  },
});

// ─── Mutations ─────────────────────────────────────────────────────────

export const create = mutation({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const title = args.title.trim();
    if (!title) {
      throw new ConvexError("Title cannot be empty");
    }
    if (title.length > 200) {
      throw new ConvexError("Title must be 200 characters or less");
    }

    return await ctx.db.insert("emailLists", {
      title,
      createdById: userId,
    });
  },
});

export const rename = mutation({
  args: { listId: v.id("emailLists"), title: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const list = await ctx.db.get(args.listId);
    if (!list || list.createdById !== userId) {
      throw new ConvexError("Not found");
    }

    await ctx.db.patch(args.listId, { title: args.title });
  },
});

export const remove = mutation({
  args: { listId: v.id("emailLists") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const list = await ctx.db.get(args.listId);
    if (!list || list.createdById !== userId) {
      throw new ConvexError("Not found");
    }

    // Delete all entries first
    const entries = await ctx.db
      .query("emailListEntries")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .collect();
    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }

    await ctx.db.delete(args.listId);
  },
});

export const addEntry = mutation({
  args: {
    listId: v.id("emailLists"),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const list = await ctx.db.get(args.listId);
    if (!list || list.createdById !== userId) {
      throw new ConvexError("Not found");
    }

    return await ctx.db.insert("emailListEntries", {
      listId: args.listId,
      name: args.name,
      email: args.email,
    });
  },
});

export const updateEntry = mutation({
  args: {
    entryId: v.id("emailListEntries"),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new ConvexError("Not found");
    }

    const list = await ctx.db.get(entry.listId);
    if (!list || list.createdById !== userId) {
      throw new ConvexError("Not found");
    }

    await ctx.db.patch(args.entryId, {
      name: args.name,
      email: args.email,
    });
  },
});

export const removeEntry = mutation({
  args: { entryId: v.id("emailListEntries") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new ConvexError("Not found");
    }

    const list = await ctx.db.get(entry.listId);
    if (!list || list.createdById !== userId) {
      throw new ConvexError("Not found");
    }

    await ctx.db.delete(args.entryId);
  },
});
