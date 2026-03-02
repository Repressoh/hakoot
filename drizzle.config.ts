import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // biome-ignore lint/style/noNonNullAssertion: DATABASE_URL must be set for drizzle-kit to work
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
