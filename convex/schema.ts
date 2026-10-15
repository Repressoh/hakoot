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
    hostId: v.id("users"),
    inviteCode: v.string(),
    status: v.union(
      v.literal("waiting"),
      v.literal("in_progress"),
      v.literal("finished")
    ),
    stepStartedAt: v.optional(v.number()),
  })
    .index("by_game", ["gameId"])
    .index("by_host", ["hostId"])
    .index("by_invite_code", ["inviteCode"]),

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
          })
        ),
        code: v.string(),
        language: v.string(),
      })
    ),
    gameId: v.id("games"),
    // Theory fields
    markdownContent: v.optional(v.string()),
    order: v.number(),
    // Quiz fields
    question: v.optional(v.string()),
    timeLimitSeconds: v.optional(v.number()),
    type: v.union(v.literal("theory"), v.literal("quiz")),
  })
    .index("by_game", ["gameId"])
    .index("by_game_and_order", ["gameId", "order"]),

  // ─── Game template ───────────────────────────────────────────────────
  games: defineTable({
    createdById: v.id("users"),
    description: v.optional(v.string()),
    title: v.string(),
    updatedAt: v.number(),
  }).index("by_creator", ["createdById"]),

  // ─── Participant answer ──────────────────────────────────────────────
  participantAnswers: defineTable({
    choiceIndex: v.number(),
    isCorrect: v.boolean(),
    participantId: v.id("gameParticipants"),
    score: v.number(),
    sessionId: v.optional(v.id("gameSessions")),
    stepId: v.id("gameSteps"),
  })
    .index("by_session", ["sessionId"])
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
