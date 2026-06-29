import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation } from "./_generated/server";

const PASS_TTL_MS = 2 * 60 * 1000;

export async function assertTurnstilePass(
  ctx: MutationCtx,
  passId: string,
  scope: string
): Promise<void> {
  const pass = await ctx.db
    .query("turnstilePasses")
    .withIndex("by_pass_id", (q) => q.eq("passId", passId))
    .first();

  if (
    !pass ||
    pass.consumed ||
    pass.scope !== scope ||
    Date.now() > pass.expiresAt
  ) {
    throw new Error("Turnstile verification expired. Please try again.");
  }

  await ctx.db.patch(pass._id, { consumed: true });
}

export const createPass = internalMutation({
  args: {
    passId: v.string(),
    scope: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("turnstilePasses", {
      passId: args.passId,
      scope: args.scope,
      expiresAt: Date.now() + PASS_TTL_MS,
      consumed: false,
    });
  },
});

export const consumePass = mutation({
  args: {
    passId: v.string(),
    scope: v.string(),
  },
  handler: async (ctx, args) => {
    await assertTurnstilePass(ctx, args.passId, args.scope);
  },
});
