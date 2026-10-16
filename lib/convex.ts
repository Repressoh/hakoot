import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set. " +
      "When building with Docker, pass it as a build arg: " +
      "--build-arg NEXT_PUBLIC_CONVEX_URL=<your-convex-url>"
  );
}

/**
 * The app's one Convex client. Importing this module opens its WebSocket, so
 * the landing page imports it only once someone starts joining a game; the
 * session page they land on then reuses the open connection.
 */
export const convex = new ConvexReactClient(convexUrl);
