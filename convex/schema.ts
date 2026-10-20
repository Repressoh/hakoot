import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // ─── Email list entry ───────────────────────────────────────────────
  emailListEntries: defineTable({
    email: v.string(),
    listId: v.id("emailLists"),
    name: v.string(),
  }).index("by_list", ["listId"]),

  // ─── Email list ──────────────────────────────────────────────────────
  emailLists: defineTable({
    createdById: v.id("users"),
    title: v.string(),
  }).index("by_creator", ["createdById"]),

  // ─── Game participant (guest player) ────────────────────────────────
  gameParticipants: defineTable({
    email: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    // Legacy: heartbeats now go to participantPresence. Still read as a
    // fallback for players who joined before that table existed.
    lastSeen: v.optional(v.number()),
    name: v.string(),
    participantToken: v.string(),
    sessionId: v.id("gameSessions"),
    totalScore: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_token", ["participantToken"])
    .index("by_expiration", ["expiresAt"]),

  // ─── Game session (live run) ────────────────────────────────────────
  gameSessions: defineTable({
    answerRevealed: v.boolean(),
    currentStepIndex: v.number(),
    gameId: v.id("games"),
    // The signed-in host: the game's owner. Absent on a session started from
    // the game's share link, whose host proves it with a token instead.
    hostId: v.optional(v.id("users")),
    // SHA-256 (hex) of the token given to whoever started the session from
    // the share link.
    hostTokenHash: v.optional(v.string()),
    inviteCode: v.string(),
    // The game's share generation when the session was started from its
    // share link (see games.shareGeneration).
    shareGeneration: v.optional(v.number()),
    // The share token the session was started with. Its host keeps access
    // only while that token is still the game's enabled link, in the same
    // share generation.
    shareToken: v.optional(v.string()),
    status: v.union(
      v.literal("waiting"),
      v.literal("in_progress"),
      v.literal("finished")
    ),
    stepStartedAt: v.optional(v.number()),
  })
    .index("by_game", ["gameId"])
    .index("by_game_and_host", ["gameId", "hostId"])
    .index("by_host", ["hostId"])
    .index("by_host_and_status", ["hostId", "status"])
    .index("by_invite_code", ["inviteCode"])
    .index("by_share_token_and_status_and_share_generation", [
      "shareToken",
      "status",
      "shareGeneration",
    ]),

  // ─── Game step (theory or quiz) ─────────────────────────────────────
  gameSteps: defineTable({
    choices: v.optional(
      v.array(
        v.object({
          isCorrect: v.boolean(),
          text: v.string(),
        })
      )
    ),
    codeBlock: v.optional(
      v.object({
        annotations: v.array(
          v.object({
            explanation: v.string(),
            label: v.string(),
            lines: v.array(v.number()),
            // The lines as typed ("5, 10-12"), so a half-typed range like
            // "5-" survives reopening the step; `lines` is what it parses to.
            linesText: v.optional(v.string()),
          })
        ),
        code: v.string(),
        language: v.string(),
      })
    ),
    gameId: v.id("games"),
    // Shown above the step's content. A copied game's steps share their
    // originals' files, so a file is deleted once no step uses it.
    image: v.optional(
      v.object({
        alt: v.optional(v.string()),
        // Pixel size, so the space is reserved before the image loads.
        height: v.number(),
        // The AES-GCM key the stored file is encrypted with, base64-encoded.
        // Players get it with the step, so they can download the next step's
        // file ahead without seeing it early.
        key: v.string(),
        storageId: v.id("_storage"),
        // The image's MIME type, as its bytes showed when uploaded.
        type: v.string(),
        width: v.number(),
      })
    ),
    // Theory fields
    markdownContent: v.optional(v.string()),
    order: v.number(),
    // Quiz fields
    question: v.optional(v.string()),
    timeLimitSeconds: v.optional(v.number()),
    type: v.union(v.literal("theory"), v.literal("quiz")),
  })
    .index("by_game", ["gameId"])
    .index("by_game_and_order", ["gameId", "order"])
    .index("by_image_storage_id", ["image.storageId"]),

  // ─── Game template ───────────────────────────────────────────────────
  games: defineTable({
    createdById: v.id("users"),
    description: v.optional(v.string()),
    // Whether the share link works: anyone who has it can host the game, and
    // signed-in users can copy it. Off unless the owner turns it on.
    shareEnabled: v.optional(v.boolean()),
    // Goes up each time the share link is turned off or reset. Sessions
    // started from the link in an earlier generation are over.
    shareGeneration: v.optional(v.number()),
    // The share link's secret. Kept when sharing is turned off, so turning
    // it back on restores the same link; replaced when the owner resets it.
    shareToken: v.optional(v.string()),
    title: v.string(),
    updatedAt: v.number(),
  })
    .index("by_creator", ["createdById"])
    .index("by_share_token", ["shareToken"]),

  // ─── Participant answer ──────────────────────────────────────────────
  participantAnswers: defineTable({
    choiceIndex: v.number(),
    isCorrect: v.boolean(),
    participantId: v.id("gameParticipants"),
    score: v.number(),
    sessionId: v.optional(v.id("gameSessions")),
    stepId: v.id("gameSteps"),
  })
    // Answers saved before answers had a session id are found with
    // `sessionId: undefined`.
    .index("by_session_and_step", ["sessionId", "stepId"])
    .index("by_participant", ["participantId"])
    .index("by_step", ["stepId"])
    .index("by_participant_and_step", ["participantId", "stepId"]),

  // ─── Participant presence (lobby heartbeats) ────────────────────────
  // Kept apart from gameParticipants so a heartbeat every few seconds per
  // player doesn't re-run every query that reads the participants
  // (leaderboard, answer count, player state, host view).
  participantPresence: defineTable({
    lastSeen: v.number(),
    participantId: v.id("gameParticipants"),
    sessionId: v.id("gameSessions"),
  })
    .index("by_participant", ["participantId"])
    .index("by_session", ["sessionId"]),

  // ─── Rate limiting ───────────────────────────────────────────────────
  rateLimits: defineTable({
    attempts: v.number(),
    endpoint: v.string(),
    identifier: v.string(),
    windowStart: v.number(),
  }).index("by_identifier_and_endpoint", ["identifier", "endpoint"]),
});
