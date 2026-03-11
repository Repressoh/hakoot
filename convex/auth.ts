import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password, Google],
  callbacks: {
    /**
     * When a user signs in with Google and the same email already exists
     * as a password-based account, link the Google account to the existing
     * user instead of creating a duplicate. This lets users sign in with
     * either email+password OR Google afterwards.
     */
    async createOrUpdateUser(ctx, args) {
      console.log(
        "[createOrUpdateUser] type:",
        args.type,
        "existingUserId:",
        args.existingUserId,
        "email:",
        args.profile?.email
      );
      try {
        if (args.existingUserId) {
          // Existing account for this provider — just return as-is
          console.log(
            "[createOrUpdateUser] existing user ID found for provider:",
            args.existingUserId
          );
          return args.existingUserId;
        }

        // For OAuth providers with a verified email, check if there's already
        // an account registered with the same email via another provider.
        if (
          args.type === "oauth" &&
          args.profile.email &&
          args.profile.emailVerified
        ) {
          const existing = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("email"), args.profile.email))
            .first();
          if (existing) {
            // Merge: return the existing user ID so the new OAuth account
            // gets linked to the same user record.
            console.log(
              "[createOrUpdateUser] merging with existing user:",
              existing._id
            );
            return existing._id;
          }
        }

        // Default: create a new user
        const newId = await ctx.db.insert("users", {
          email: args.profile.email as string | undefined,
          name: args.profile.name as string | undefined,
          image: args.profile.image as string | undefined,
          emailVerified: args.profile.emailVerified
            ? new Date().toISOString()
            : undefined,
        });
        console.log("[createOrUpdateUser] created new user:", newId);
        return newId;
      } catch (err) {
        console.error("[createOrUpdateUser] error:", err);
        throw err;
      }
    },
  },
});
