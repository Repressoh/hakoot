import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // ─── Game template ───────────────────────────────────────────────────
  games: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    createdById: v.id("users"),
    updatedAt: v.number(),
  }).index("by_creator", ["createdById"]),

  // ─── Game step (theory or quiz) ─────────────────────────────────────
  gameSteps: defineTable({
    gameId: v.id("games"),
    order: v.number(),
    type: v.union(v.literal("theory"), v.literal("quiz")),
    // Theory fields
    markdownContent: v.optional(v.string()),
    codeBlock: v.optional(
      v.object({
        code: v.string(),
        language: v.string(),
        annotations: v.array(
          v.object({
            label: v.string(),
            explanation: v.string(),
            lines: v.array(v.number()),
          })
        ),
      })
    ),
    // Quiz fields
    question: v.optional(v.string()),
    choices: v.optional(
      v.array(
        v.object({
          text: v.string(),
          isCorrect: v.boolean(),
        })
      )
    ),
    timeLimitSeconds: v.optional(v.number()),
  })
    .index("by_game", ["gameId"])
    .index("by_game_and_order", ["gameId", "order"]),

  // ─── Game session (live run) ────────────────────────────────────────
  gameSessions: defineTable({
    gameId: v.id("games"),
    hostId: v.id("users"),
    inviteCode: v.string(),
    status: v.union(
      v.literal("waiting"),
      v.literal("in_progress"),
      v.literal("finished")
    ),
    currentStepIndex: v.number(),
    stepStartedAt: v.optional(v.number()),
    answerRevealed: v.boolean(),
  })
    .index("by_game", ["gameId"])
    .index("by_host", ["hostId"])
    .index("by_invite_code", ["inviteCode"]),

  // ─── Game participant (guest player) ────────────────────────────────
  gameParticipants: defineTable({
    sessionId: v.id("gameSessions"),
    name: v.string(),
    email: v.optional(v.string()),
    participantToken: v.string(),
    totalScore: v.number(),
    lastSeen: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_token", ["participantToken"])
    .index("by_expiration", ["expiresAt"]),

  // ─── Email list ──────────────────────────────────────────────────────
  emailLists: defineTable({
    title: v.string(),
    createdById: v.id("users"),
  }).index("by_creator", ["createdById"]),

  // ─── Email list entry ───────────────────────────────────────────────
  emailListEntries: defineTable({
    listId: v.id("emailLists"),
    name: v.string(),
    email: v.string(),
  }).index("by_list", ["listId"]),

  // ─── Participant answer ──────────────────────────────────────────────
  participantAnswers: defineTable({
    participantId: v.id("gameParticipants"),
    sessionId: v.optional(v.id("gameSessions")),
    stepId: v.id("gameSteps"),
    choiceIndex: v.number(),
    isCorrect: v.boolean(),
    score: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_participant", ["participantId"])
    .index("by_step", ["stepId"])
    .index("by_participant_and_step", ["participantId", "stepId"]),

  // ─── Rate limiting ───────────────────────────────────────────────────
  rateLimits: defineTable({
    identifier: v.string(),
    endpoint: v.string(),
    attempts: v.number(),
    windowStart: v.number(),
  }).index("by_identifier_and_endpoint", ["identifier", "endpoint"]),
});
