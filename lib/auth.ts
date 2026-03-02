import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
// biome-ignore lint/performance/noNamespaceImport: better-auth drizzleAdapter requires all schema tables
import * as schema from "./db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      // biome-ignore lint/style/noNonNullAssertion: guarded by enabled flag above
      clientId: process.env.GOOGLE_CLIENT_ID!,
      // biome-ignore lint/style/noNonNullAssertion: guarded by enabled flag above
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      enabled: !!(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes cache
    },
  },
});

export type Session = typeof auth.$Infer.Session;
