import { api } from "@/convex/_generated/api";
import { convex } from "@/lib/convex";

/**
 * Joins a game with its invite code through the app's Convex client. The
 * landing page imports this module only once someone starts joining: it brings
 * the Convex client (opening its WebSocket) and the generated API with it.
 */
export function joinByCode(args: { inviteCode: string; name: string }) {
  return convex.mutation(api.sessions.joinByCode, args);
}
