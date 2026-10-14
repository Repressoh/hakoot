import {
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  type ActionCtx,
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { deleteEmailListCascade } from "./emailLists";

// ─── Queries ────────────────────────────────────────────────────────────

/** Returns the list of auth providers linked to the current user's account. */
export const getLinkedProviders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
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
  handler: async (ctx, { userId }) =>
    await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", "password")
      )
      .first(),
});

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) =>
    await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first(),
});

/** Set the new email on the user and on their password account. */
export const updateUserEmail = internalMutation({
  args: {
    accountId: v.id("authAccounts"),
    newEmail: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, { userId, accountId, newEmail }) => {
    await ctx.db.patch(userId, { email: newEmail });
    await ctx.db.patch(accountId, { providerAccountId: newEmail });
  },
});

/**
 * Delete everything the user owns: games (one scheduled mutation each), email lists, sign-in codes,
 * auth accounts and the user.
 */
export const deleteAllData = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const [games, emailLists, authAccounts] = await Promise.all([
      ctx.db
        .query("games")
        .withIndex("by_creator", (q) => q.eq("createdById", userId))
        .collect(),
      ctx.db
        .query("emailLists")
        .withIndex("by_creator", (q) => q.eq("createdById", userId))
        .collect(),
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    // Games cascade (steps, sessions, participants, answers). Each runs in its
    // own transaction so a busy account doesn't exceed per-mutation limits.
    await Promise.all(
      games.map((game) =>
        ctx.scheduler.runAfter(0, internal.games.deleteGameData, {
          gameId: game._id,
        })
      )
    );

    // Email lists hold other people's names and addresses
    await Promise.all(
      emailLists.map((emailList) => deleteEmailListCascade(ctx, emailList._id))
    );

    // Auth accounts and any unused sign-in codes for them
    await Promise.all(
      authAccounts.map(async (account) => {
        const codes = await ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", account._id))
          .collect();
        await Promise.all(codes.map((code) => ctx.db.delete(code._id)));
        await ctx.db.delete(account._id);
      })
    );

    // Delete the user
    await ctx.db.delete(userId);
  },
});

/** Whether `password` is the current password for the password account `email`. */
async function isPasswordValid(
  ctx: ActionCtx,
  email: string,
  password: string
): Promise<boolean> {
  try {
    await retrieveAccount(ctx, {
      account: { id: email, secret: password },
      provider: "password",
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Actions ────────────────────────────────────────────────────────────

/** Change the email address for a password-based account. */
export const changeEmail = action({
  args: {
    currentPassword: v.string(),
    newEmail: v.string(),
  },
  handler: async (ctx, { newEmail, currentPassword }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const passwordAccount = await ctx.runQuery(
      internal.account.getPasswordAccount,
      { userId }
    );
    if (!passwordAccount) {
      throw new ConvexError("No password account linked");
    }

    const currentEmail = passwordAccount.providerAccountId;

    // Verify current password before allowing email change
    const passwordValid = await isPasswordValid(
      ctx,
      currentEmail,
      currentPassword
    );
    if (!passwordValid) {
      throw new ConvexError("Invalid password");
    }

    // Validate new email format
    // biome-ignore lint/performance/useTopLevelRegex: this regex is used in a convex action, it cannot be put in a higher level
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
    if (existing) {
      throw new ConvexError("Email already in use");
    }

    await ctx.runMutation(internal.account.updateUserEmail, {
      accountId: passwordAccount._id,
      newEmail: normalizedEmail,
      userId,
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
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const passwordAccount = await ctx.runQuery(
      internal.account.getPasswordAccount,
      { userId }
    );
    if (!passwordAccount) {
      throw new ConvexError("No password account linked");
    }

    const email = passwordAccount.providerAccountId;

    // Verify current password
    const passwordValid = await isPasswordValid(ctx, email, currentPassword);
    if (!passwordValid) {
      throw new ConvexError("Invalid current password");
    }

    if (newPassword.length < 8) {
      throw new ConvexError("Password must be at least 8 characters");
    }

    await modifyAccountCredentials(ctx, {
      account: { id: email, secret: newPassword },
      provider: "password",
    });
  },
});

/** Delete ALL data for the current user and invalidate sessions. */
export const deleteUserData = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Invalidate all sessions so tokens stop working
    await invalidateSessions(ctx, { userId });

    // Delete everything from the database
    await ctx.runMutation(internal.account.deleteAllData, { userId });
  },
});
