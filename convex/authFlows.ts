import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalMutation } from "./_generated/server";

const MAGIC_LINK_LIMIT = { maxAttempts: 5, windowMs: 60 * 60 * 1000 };

export const checkMagicLinkRate = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const identifier = `magic:${args.email}`;
    const now = Date.now();
    const windowStart = now - MAGIC_LINK_LIMIT.windowMs;

    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_identifier_and_endpoint", (q) =>
        q.eq("identifier", identifier).eq("endpoint", "magicLink")
      )
      .first();

    if (existing) {
      if (existing.windowStart > windowStart) {
        if (existing.attempts >= MAGIC_LINK_LIMIT.maxAttempts) {
          throw new ConvexError(
            "Too many magic link requests. Try again later."
          );
        }
        await ctx.db.patch(existing._id, {
          attempts: existing.attempts + 1,
        });
        return;
      }
      await ctx.db.patch(existing._id, {
        attempts: 1,
        windowStart: now,
      });
      return;
    }

    await ctx.db.insert("rateLimits", {
      identifier,
      endpoint: "magicLink",
      attempts: 1,
      windowStart: now,
    });
  },
});

export const requestMagicLink = action({
  args: {
    email: v.string(),
    turnstileToken: v.string(),
    redirectTo: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    redirect?: string;
    verifier?: string;
    started?: boolean;
  }> => {
    const email = args.email.trim().toLowerCase();
    if (!email) {
      throw new Error("Email is required");
    }

    const verifyResponse = await fetch(
      `${process.env.CONVEX_SITE_URL}/verify-turnstile`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: args.turnstileToken }),
      }
    );
    const verifyResult = (await verifyResponse.json()) as { success?: boolean };
    if (!verifyResult.success) {
      throw new Error("Turnstile verification failed");
    }

    await ctx.runMutation(internal.authFlows.checkMagicLinkRate, { email });

    return await ctx.runAction(api.auth.signIn, {
      provider: "email",
      params: {
        email,
        redirectTo: args.redirectTo ?? "/dashboard",
      },
    });
  },
});
