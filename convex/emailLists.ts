// biome-ignore lint/style/useFilenamingConvention: convex's fault
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";

/** Delete an email list and all of its entries. */
export async function deleteEmailListCascade(
  ctx: MutationCtx,
  listId: Id<"emailLists">
): Promise<void> {
  const entries = await ctx.db
    .query("emailListEntries")
    .withIndex("by_list", (q) => q.eq("listId", listId))
    .collect();
  await Promise.all(entries.map((entry) => ctx.db.delete(entry._id)));
  await ctx.db.delete(listId);
}

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

    const emailList = await ctx.db.get(args.listId);
    if (!emailList || emailList.createdById !== userId) {
      return null;
    }

    const entries = await ctx.db
      .query("emailListEntries")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .collect();

    return { ...emailList, entries };
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
      lists.map(async (emailList) => {
        const entries = await ctx.db
          .query("emailListEntries")
          .withIndex("by_list", (q) => q.eq("listId", emailList._id))
          .collect();
        return { ...emailList, entries };
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
      createdById: userId,
      title,
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

    const emailList = await ctx.db.get(args.listId);
    if (!emailList || emailList.createdById !== userId) {
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

    const emailList = await ctx.db.get(args.listId);
    if (!emailList || emailList.createdById !== userId) {
      throw new ConvexError("Not found");
    }

    await deleteEmailListCascade(ctx, args.listId);
  },
});

export const addEntry = mutation({
  args: {
    email: v.string(),
    listId: v.id("emailLists"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const emailList = await ctx.db.get(args.listId);
    if (!emailList || emailList.createdById !== userId) {
      throw new ConvexError("Not found");
    }

    return await ctx.db.insert("emailListEntries", {
      email: args.email,
      listId: args.listId,
      name: args.name,
    });
  },
});

export const updateEntry = mutation({
  args: {
    email: v.string(),
    entryId: v.id("emailListEntries"),
    name: v.string(),
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

    const emailList = await ctx.db.get(entry.listId);
    if (!emailList || emailList.createdById !== userId) {
      throw new ConvexError("Not found");
    }

    await ctx.db.patch(args.entryId, {
      email: args.email,
      name: args.name,
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

    const emailList = await ctx.db.get(entry.listId);
    if (!emailList || emailList.createdById !== userId) {
      throw new ConvexError("Not found");
    }

    await ctx.db.delete(args.entryId);
  },
});
