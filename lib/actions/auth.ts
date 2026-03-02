"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** Returns the current session or null */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Returns the current user or throws if not authenticated */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
