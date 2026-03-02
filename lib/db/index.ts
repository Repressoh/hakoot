import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// biome-ignore lint/performance/noNamespaceImport: drizzle requires all schema tables for relation queries
import * as schema from "./schema";

// biome-ignore lint/style/noNonNullAssertion: DATABASE_URL must be set for the app to function
const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it's not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
