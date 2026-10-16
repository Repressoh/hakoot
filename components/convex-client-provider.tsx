"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import type { ReactNode } from "react";
import { convex } from "@/lib/convex";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
