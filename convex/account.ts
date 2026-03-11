import {
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Queries ────────────────────────────────────────────────────────────

/** Returns the list of auth providers linked to the current user's account. */
export const getLinkedProviders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    return accounts.map((a) => a.provider);
  },
});

// ─── Internal helpers ────────────────────────────────────────────────────

export const getPasswordAccount = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", "password")
      )
      .first();
  },
});

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first();
  },
});

export const updateUserEmail = internalMutation({
  args: {
    userId: v.id("users"),
    accountId: v.id("authAccounts"),
    newEmail: v.string(),
  },
  handler: async (ctx, { userId, accountId, newEmail }) => {
    await ctx.db.patch(userId, { email: newEmail });
    await ctx.db.patch(accountId, { providerAccountId: newEmail });
  },
});

export const deleteAllData = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Delete games cascade (steps, sessions, participants)
    const games = await ctx.db
      .query("games")
      .withIndex("by_creator", (q) => q.eq("createdById", userId))
      .collect();

    for (const game of games) {
      const steps = await ctx.db
        .query("gameSteps")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();
      for (const step of steps) await ctx.db.delete(step._id);

      const sessions = await ctx.db
        .query("gameSessions")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();
      for (const session of sessions) {
        const participants = await ctx.db
          .query("gameParticipants")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        for (const p of participants) await ctx.db.delete(p._id);
        await ctx.db.delete(session._id);
      }

      await ctx.db.delete(game._id);
    }

    // Delete auth accounts
    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const account of authAccounts) await ctx.db.delete(account._id);

    // Delete the user
    await ctx.db.delete(userId);
  },
});

// ─── Actions ────────────────────────────────────────────────────────────

/** Change the email address for a password-based account. */
export const changeEmail = action({
  args: {
    newEmail: v.string(),
    currentPassword: v.string(),
  },
  handler: async (ctx, { newEmail, currentPassword }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const passwordAccount = await ctx.runQuery(
      internal.account.getPasswordAccount,
      { userId }
    );
    if (!passwordAccount) throw new ConvexError("No password account linked");

    const currentEmail = passwordAccount.providerAccountId;

    // Verify current password before allowing email change
    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: currentEmail, secret: currentPassword },
      });
    } catch {
      throw new ConvexError("Invalid password");
    }

    // Validate new email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new ConvexError("Invalid email address");
    }

    const normalizedEmail = newEmail.toLowerCase().trim();

    if (normalizedEmail === currentEmail.toLowerCase()) {
      throw new ConvexError("New email is the same as current email");
    }

    // Check new email isn't already taken
    const existing = await ctx.runQuery(internal.account.getUserByEmail, {
      email: normalizedEmail,
    });
    if (existing) throw new ConvexError("Email already in use");

    await ctx.runMutation(internal.account.updateUserEmail, {
      userId,
      accountId: passwordAccount._id,
      newEmail: normalizedEmail,
    });
  },
});

/** Change the password for the current user. */
export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { currentPassword, newPassword }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const passwordAccount = await ctx.runQuery(
      internal.account.getPasswordAccount,
      { userId }
    );
    if (!passwordAccount) throw new ConvexError("No password account linked");

    const email = passwordAccount.providerAccountId;

    // Verify current password
    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: email, secret: currentPassword },
      });
    } catch {
      throw new ConvexError("Invalid current password");
    }

    if (newPassword.length < 8) {
      throw new ConvexError("Password must be at least 8 characters");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: newPassword },
    });
  },
});

/** Delete ALL data for the current user and invalidate sessions. */
export const deleteUserData = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    // Invalidate all sessions so tokens stop working
    await invalidateSessions(ctx, { userId });

    // Delete everything from the database
    await ctx.runMutation(internal.account.deleteAllData, { userId });
  },
});
