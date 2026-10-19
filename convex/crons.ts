import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup expired tokens",
  { hours: 1 },
  internal.sessions.cleanupExpiredTokens,
  {}
);

crons.interval(
  "cleanup abandoned share link lobbies",
  { hours: 1 },
  internal.sharing.cleanupAbandonedLinkSessions,
  {}
);

crons.interval(
  "cleanup old rate limits",
  { hours: 6 },
  internal.sessions.cleanupOldRateLimits,
  {}
);

export default crons;
