import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { verifyInviteToken } from "./lib/inviteTokens";
import { assertTurnstilePass } from "./turnstilePasses";

/** Generate a cryptographically random invite code */
function generateInviteCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

/** Generate a cryptographically random token */
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Rate limiting configuration */
const RATE_LIMIT_CONFIG = {
  join: { maxAttempts: 10, windowMs: 60_000 },
  joinByCode: { maxAttempts: 10, windowMs: 60_000 },
} as const;

/** Check and enforce rate limiting */
async function checkRateLimit(
  ctx: MutationCtx,
  identifier: string,
  endpoint: keyof typeof RATE_LIMIT_CONFIG
): Promise<void> {
  const config = RATE_LIMIT_CONFIG[endpoint];
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_identifier_and_endpoint", (q) =>
      q.eq("identifier", identifier).eq("endpoint", endpoint)
    )
    .first();

  if (existing) {
    if (existing.windowStart > windowStart) {
      if (existing.attempts >= config.maxAttempts) {
        throw new ConvexError("Rate limit exceeded. Please try again later.");
      }
      await ctx.db.patch(existing._id, {
        attempts: existing.attempts + 1,
      });
    } else {
      await ctx.db.patch(existing._id, {
        attempts: 1,
        windowStart: now,
      });
    }
  } else {
    await ctx.db.insert("rateLimits", {
      identifier,
      endpoint,
      attempts: 1,
      windowStart: now,
    });
  }
}

/** Sanitize user input */
function sanitizeInput(input: string, maxLength = 100): string {
  return input.trim().slice(0, maxLength).replace(/[<>]/g, "");
}

/** Token expiration time: 24 hours */
const TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000;

// ─── Queries ────────────────────────────────────────────────────────────

export const listForGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const game = await ctx.db.get(args.gameId);
    if (!game || game.createdById !== userId) {
      return [];
    }

    return await ctx.db
      .query("gameSessions")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .collect();
  },
});

export const getForHost = query({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.hostId !== userId) {
      return null;
    }

    const game = await ctx.db.get(session.gameId);
    const steps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", session.gameId))
      .collect();
    steps.sort((a, b) => a.order - b.order);

    const allParticipants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // In the waiting lobby, hide participants who stopped sending heartbeats
    const participants =
      session.status === "waiting"
        ? allParticipants.filter(
            (p) => p.lastSeen && Date.now() - p.lastSeen <= 15_000
          )
        : allParticipants;

    return { session, game, steps, participants };
  },
});

export const getByInviteCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("gameSessions")
      .withIndex("by_invite_code", (q) =>
        q.eq("inviteCode", args.code.toUpperCase())
      )
      .first();

    if (!session || session.status === "finished") {
      return null;
    }

    const game = await ctx.db.get(session.gameId);
    return {
      sessionId: session._id,
      status: session.status,
      inviteCode: session.inviteCode,
      gameTitle: game?.title ?? "",
    };
  },
});

/** Get full session state for a participant (reactive!) */
export const getPlayerState = query({
  args: {
    sessionId: v.id("gameSessions"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    const participant = await ctx.db
      .query("gameParticipants")
      .withIndex("by_token", (q) =>
        q.eq("participantToken", args.participantToken)
      )
      .first();

    if (!participant || participant.sessionId !== args.sessionId) {
      return null;
    }

    // Check if token is expired
    if (participant.expiresAt && Date.now() > participant.expiresAt) {
      return null;
    }

    const game = await ctx.db.get(session.gameId);
    const steps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", session.gameId))
      .collect();
    steps.sort((a, b) => a.order - b.order);

    const currentStep =
      session.currentStepIndex >= 0 && session.currentStepIndex < steps.length
        ? steps[session.currentStepIndex]
        : null;

    let currentAnswer: {
      choiceIndex: number;
      isCorrect: boolean;
      score: number;
    } | null = null;
    if (currentStep) {
      const answer = await ctx.db
        .query("participantAnswers")
        .withIndex("by_participant_and_step", (q) =>
          q.eq("participantId", participant._id).eq("stepId", currentStep._id)
        )
        .first();
      if (answer) {
        currentAnswer = {
          choiceIndex: answer.choiceIndex,
          isCorrect: answer.isCorrect,
          score: answer.score,
        };
      }
    }

    return {
      participant: {
        id: participant._id,
        name: participant.name,
        totalScore: participant.totalScore,
      },
      session: {
        id: session._id,
        status: session.status,
        currentStepIndex: session.currentStepIndex,
        stepStartedAt: session.stepStartedAt ?? null,
        answerRevealed: session.answerRevealed,
        totalSteps: steps.length,
        gameTitle: game?.title ?? "",
      },
      currentStep: currentStep
        ? {
            id: currentStep._id,
            type: currentStep.type,
            order: currentStep.order,
            markdownContent: currentStep.markdownContent ?? null,
            codeBlock: currentStep.codeBlock ?? null,
            question: currentStep.question ?? null,
            choices: currentStep.choices ?? null,
            timeLimitSeconds: currentStep.timeLimitSeconds ?? null,
          }
        : null,
      currentAnswer,
    };
  },
});

/** Get answer count for host view (reactive!) */
export const getAnswerCount = query({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.hostId !== userId) {
      return null;
    }

    const steps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", session.gameId))
      .collect();
    steps.sort((a, b) => a.order - b.order);

    if (
      session.currentStepIndex < 0 ||
      session.currentStepIndex >= steps.length
    ) {
      return { answered: 0, total: 0 };
    }

    const currentStep = steps[session.currentStepIndex];
    if (currentStep.type !== "quiz") {
      return { answered: 0, total: 0 };
    }

    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Count answers only from participants in THIS session
    const participantIds = new Set(participants.map((p) => p._id));
    const allAnswers = await ctx.db
      .query("participantAnswers")
      .withIndex("by_step", (q) => q.eq("stepId", currentStep._id))
      .collect();
    const answered = allAnswers.filter((a) =>
      participantIds.has(a.participantId)
    ).length;

    return { answered, total: participants.length };
  },
});

/** Get session results for host */
export const getResults = query({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.hostId !== userId) {
      return null;
    }

    const storedParticipants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const steps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", session.gameId))
      .collect();
    steps.sort((a, b) => a.order - b.order);

    const { answers: allAnswers, restoredParticipants } =
      await collectResultAnswers(
        ctx,
        args.sessionId,
        steps,
        storedParticipants
      );

    const participants = [...storedParticipants, ...restoredParticipants];
    participants.sort((a, b) => b.totalScore - a.totalScore);

    return { session, participants, steps, answers: allAnswers };
  },
});

async function collectResultAnswers(
  ctx: QueryCtx,
  sessionId: Id<"gameSessions">,
  steps: Doc<"gameSteps">[],
  storedParticipants: Doc<"gameParticipants">[]
) {
  const sessionAnswers = await ctx.db
    .query("participantAnswers")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();

  if (sessionAnswers.length > 0) {
    return {
      answers: sessionAnswers,
      restoredParticipants: [] as RestoredParticipant[],
    };
  }

  return await collectLegacyResultAnswers(
    ctx,
    sessionId,
    steps,
    storedParticipants
  );
}

async function collectLegacyResultAnswers(
  ctx: QueryCtx,
  sessionId: Id<"gameSessions">,
  steps: Doc<"gameSteps">[],
  storedParticipants: Doc<"gameParticipants">[]
) {
  const participantById = new Map(
    storedParticipants.map((participant) => [participant._id, participant])
  );
  const scoreByMissingParticipant = new Map<Id<"gameParticipants">, number>();
  const answers: Doc<"participantAnswers">[] = [];

  for (const step of steps) {
    if (step.type !== "quiz") {
      continue;
    }

    const stepAnswers = await ctx.db
      .query("participantAnswers")
      .withIndex("by_step", (q) => q.eq("stepId", step._id))
      .collect();

    for (const answer of stepAnswers) {
      if (
        storedParticipants.length > 0 &&
        !participantById.has(answer.participantId)
      ) {
        continue;
      }

      answers.push(answer);
      if (!participantById.has(answer.participantId)) {
        scoreByMissingParticipant.set(
          answer.participantId,
          (scoreByMissingParticipant.get(answer.participantId) ?? 0) +
            answer.score
        );
      }
    }
  }

  return {
    answers,
    restoredParticipants: buildRestoredParticipants(
      sessionId,
      scoreByMissingParticipant
    ),
  };
}

type RestoredParticipant = Omit<
  Doc<"gameParticipants">,
  "email" | "expiresAt" | "lastSeen"
>;

function buildRestoredParticipants(
  sessionId: Id<"gameSessions">,
  scoreByMissingParticipant: Map<Id<"gameParticipants">, number>
): RestoredParticipant[] {
  return Array.from(
    scoreByMissingParticipant.entries(),
    ([participantId, totalScore], index) => ({
      _id: participantId,
      _creationTime: 0,
      sessionId,
      name: `Archived participant ${index + 1}`,
      participantToken: "",
      totalScore,
    })
  );
}

/** Get leaderboard for a session */
export const getLeaderboard = query({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    participants.sort((a, b) => b.totalScore - a.totalScore);

    return participants.map((p, i) => ({
      rank: i + 1,
      name: p.name,
      score: p.totalScore,
    }));
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────

export const create = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }

    const game = await ctx.db.get(args.gameId);
    if (!game || game.createdById !== userId) {
      throw new ConvexError("Not found");
    }

    const inviteCode = generateInviteCode();

    return await ctx.db.insert("gameSessions", {
      gameId: args.gameId,
      hostId: userId,
      inviteCode,
      status: "waiting",
      currentStepIndex: -1,
      answerRevealed: false,
    });
  },
});

export const join = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    name: v.string(),
    email: v.optional(v.string()),
    existingToken: v.optional(v.string()),
    inviteToken: v.optional(v.string()),
    turnstilePassId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Use session ID only to prevent bypass via name variation
    const identifier = `session:${args.sessionId}`;
    await checkRateLimit(ctx, identifier, "join");

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Session not found");
    }
    if (session.status === "finished") {
      throw new ConvexError("Session has ended");
    }

    // Rejoin with existing token
    if (args.existingToken) {
      const existingToken = args.existingToken;
      const existing = await ctx.db
        .query("gameParticipants")
        .withIndex("by_token", (q) => q.eq("participantToken", existingToken))
        .first();
      if (existing && existing.sessionId === args.sessionId) {
        // Check if token is expired
        if (existing.expiresAt && Date.now() > existing.expiresAt) {
          throw new ConvexError("Token expired. Please rejoin.");
        }
        await ctx.db.patch(existing._id, { lastSeen: Date.now() });
        return {
          participantId: existing._id,
          participantToken: existing.participantToken,
        };
      }
    }

    const sanitizedName = sanitizeInput(args.name, 50);
    if (!sanitizedName) {
      throw new ConvexError("Invalid name");
    }

    if (args.inviteToken) {
      const validInvite = await verifyInviteToken(
        args.sessionId,
        sanitizedName,
        args.inviteToken
      );
      if (!validInvite) {
        throw new ConvexError("Invalid or expired invite link");
      }
    } else if (args.turnstilePassId) {
      await assertTurnstilePass(ctx, args.turnstilePassId, "joinSession");
    } else {
      throw new ConvexError("Invite verification required");
    }

    const token = generateToken();
    const expiresAt = Date.now() + TOKEN_EXPIRATION_MS;

    const participantId = await ctx.db.insert("gameParticipants", {
      sessionId: args.sessionId,
      name: sanitizedName,
      email: args.email,
      participantToken: token,
      totalScore: 0,
      lastSeen: Date.now(),
      expiresAt,
    });

    return { participantId, participantToken: token };
  },
});

/** Join a session by invite code (combines lookup + join in one call) */
export const joinByCode = mutation({
  args: {
    inviteCode: v.string(),
    name: v.string(),
    existingToken: v.optional(v.string()),
    turnstilePassId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertTurnstilePass(ctx, args.turnstilePassId, "joinByCode");

    const sanitizedCode = args.inviteCode.toUpperCase().trim();
    const identifier = `code:${sanitizedCode}`;
    await checkRateLimit(ctx, identifier, "joinByCode");

    const session = await ctx.db
      .query("gameSessions")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", sanitizedCode))
      .first();

    if (!session) {
      throw new ConvexError("Invalid invite code");
    }
    if (session.status === "finished") {
      throw new ConvexError("Session has ended");
    }

    // Rejoin with existing token
    if (args.existingToken) {
      const existingToken = args.existingToken;
      const existing = await ctx.db
        .query("gameParticipants")
        .withIndex("by_token", (q) => q.eq("participantToken", existingToken))
        .first();
      if (existing && existing.sessionId === session._id) {
        // Check if token is expired
        if (existing.expiresAt && Date.now() > existing.expiresAt) {
          throw new ConvexError("Token expired. Please rejoin.");
        }
        await ctx.db.patch(existing._id, { lastSeen: Date.now() });
        return {
          sessionId: session._id,
          participantToken: existing.participantToken,
        };
      }
    }

    const sanitizedName = sanitizeInput(args.name, 50);
    if (!sanitizedName) {
      throw new ConvexError("Invalid name");
    }

    const token = generateToken();
    const expiresAt = Date.now() + TOKEN_EXPIRATION_MS;

    await ctx.db.insert("gameParticipants", {
      sessionId: session._id,
      name: sanitizedName,
      participantToken: token,
      totalScore: 0,
      lastSeen: Date.now(),
      expiresAt,
    });

    return { sessionId: session._id, participantToken: token };
  },
});

/** Heartbeat: update lastSeen for a participant */
export const heartbeat = mutation({
  args: { participantToken: v.string() },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("gameParticipants")
      .withIndex("by_token", (q) =>
        q.eq("participantToken", args.participantToken)
      )
      .first();
    if (!participant) {
      return;
    }
    await ctx.db.patch(participant._id, { lastSeen: Date.now() });
  },
});

/** Stale threshold: participants unseen for this long are removed in lobby */
const STALE_THRESHOLD_MS = 15_000; // 15 seconds

export const advance = mutation({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.hostId !== userId) {
      throw new ConvexError("Not found");
    }

    const steps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", session.gameId))
      .collect();
    steps.sort((a, b) => a.order - b.order);

    const nextIndex = session.currentStepIndex + 1;

    // When starting from lobby, remove stale participants
    if (session.status === "waiting") {
      const participants = await ctx.db
        .query("gameParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      const now = Date.now();
      for (const p of participants) {
        if (!p.lastSeen || now - p.lastSeen > STALE_THRESHOLD_MS) {
          await ctx.db.delete(p._id);
        }
      }
    }

    if (nextIndex >= steps.length) {
      // Session is finished
      await ctx.db.patch(args.sessionId, {
        status: "finished",
        currentStepIndex: session.currentStepIndex,
      });
      return { stepIndex: session.currentStepIndex, status: "finished" };
    }

    const nextStep = steps[nextIndex];
    const hasTimer = nextStep.type === "quiz" && nextStep.timeLimitSeconds;
    // Add 10-second reading phase before the answer timer starts
    const READING_PHASE_MS = 10_000;
    const timerStartsAt = hasTimer ? Date.now() + READING_PHASE_MS : undefined;

    await ctx.db.patch(args.sessionId, {
      status: "in_progress",
      currentStepIndex: nextIndex,
      stepStartedAt: timerStartsAt,
      answerRevealed: false,
    });

    return { stepIndex: nextIndex, status: "in_progress" };
  },
});

export const reveal = mutation({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.hostId !== userId) {
      throw new ConvexError("Not found");
    }

    if (session.answerRevealed) {
      return null; // Idempotent
    }

    const steps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", session.gameId))
      .collect();
    steps.sort((a, b) => a.order - b.order);

    const currentStep = steps[session.currentStepIndex];
    if (currentStep?.type !== "quiz") {
      return null;
    }

    // Apply scores to totalScore
    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const p of participants) {
      const answer = await ctx.db
        .query("participantAnswers")
        .withIndex("by_participant_and_step", (q) =>
          q.eq("participantId", p._id).eq("stepId", currentStep._id)
        )
        .first();
      if (answer) {
        await ctx.db.patch(p._id, {
          totalScore: Math.max(0, p.totalScore + answer.score),
        });
      }
    }

    await ctx.db.patch(args.sessionId, { answerRevealed: true });
    return null;
  },
});

export const submitAnswer = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    participantToken: v.string(),
    choiceIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session?.status !== "in_progress") {
      throw new ConvexError("Session not active");
    }

    const participant = await ctx.db
      .query("gameParticipants")
      .withIndex("by_token", (q) =>
        q.eq("participantToken", args.participantToken)
      )
      .first();

    if (!participant || participant.sessionId !== args.sessionId) {
      throw new ConvexError("Invalid participant");
    }

    const currentStep = await getActiveQuizStep(ctx, session.gameId, session);
    assertAnsweringOpen(session);

    // Check for duplicate answer
    const existing = await ctx.db
      .query("participantAnswers")
      .withIndex("by_participant_and_step", (q) =>
        q.eq("participantId", participant._id).eq("stepId", currentStep._id)
      )
      .first();

    if (existing) {
      throw new ConvexError("Already answered");
    }

    const choices = currentStep.choices ?? [];
    const isCorrect = choices[args.choiceIndex]?.isCorrect ?? false;

    // Compute Kahoot-style score
    const score = computeScore(
      isCorrect,
      currentStep.timeLimitSeconds ?? null,
      Date.now(),
      session.stepStartedAt ?? Date.now()
    );

    await ctx.db.insert("participantAnswers", {
      participantId: participant._id,
      sessionId: args.sessionId,
      stepId: currentStep._id,
      choiceIndex: args.choiceIndex,
      isCorrect,
      score,
    });

    // Check if all participants in THIS session have answered → auto-reveal
    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const participantIds = new Set(participants.map((p) => p._id));
    const allStepAnswers = await ctx.db
      .query("participantAnswers")
      .withIndex("by_step", (q) => q.eq("stepId", currentStep._id))
      .collect();
    const sessionAnswerCount = allStepAnswers.filter((a) =>
      participantIds.has(a.participantId)
    ).length;

    if (sessionAnswerCount >= participants.length && !session.answerRevealed) {
      await applyStepScoresAndReveal(
        ctx,
        args.sessionId,
        participants,
        currentStep._id
      );
    }

    return { isCorrect, score };
  },
});

async function getActiveQuizStep(
  ctx: MutationCtx,
  gameId: Id<"games">,
  session: {
    currentStepIndex: number;
  }
) {
  const steps = await ctx.db
    .query("gameSteps")
    .withIndex("by_game", (q) => q.eq("gameId", gameId))
    .collect();
  steps.sort((a, b) => a.order - b.order);

  const currentStep = steps[session.currentStepIndex];
  if (currentStep?.type !== "quiz") {
    throw new ConvexError("Not a quiz step");
  }

  return currentStep;
}

function assertAnsweringOpen(session: {
  answerRevealed: boolean;
  stepStartedAt?: number;
}) {
  if (session.answerRevealed) {
    throw new ConvexError("Answer already revealed");
  }

  if (session.stepStartedAt && Date.now() < session.stepStartedAt) {
    throw new ConvexError("Reading phase still active");
  }
}

async function applyStepScoresAndReveal(
  ctx: MutationCtx,
  sessionId: Id<"gameSessions">,
  participants: Array<{ _id: Id<"gameParticipants">; totalScore: number }>,
  stepId: Id<"gameSteps">
) {
  for (const participant of participants) {
    const answer = await ctx.db
      .query("participantAnswers")
      .withIndex("by_participant_and_step", (q) =>
        q.eq("participantId", participant._id).eq("stepId", stepId)
      )
      .first();
    if (answer) {
      await ctx.db.patch(participant._id, {
        totalScore: Math.max(0, participant.totalScore + answer.score),
      });
    }
  }

  await ctx.db.patch(sessionId, { answerRevealed: true });
}

/** Compute Kahoot-style score (positive for correct, negative for wrong) */
function computeScore(
  isCorrect: boolean,
  timeLimitSeconds: number | null,
  answeredAtMs: number,
  stepStartedAtMs: number,
  basePoints = 1000
): number {
  if (!isCorrect) {
    // Wrong answer: lose a fraction of base points
    return Math.round(-basePoints * 0.25);
  }
  if (!timeLimitSeconds) {
    return basePoints;
  }

  const elapsed = Math.max(0, answeredAtMs - stepStartedAtMs) / 1000;
  if (elapsed >= timeLimitSeconds) {
    return 0;
  }

  const timeRemaining = timeLimitSeconds - elapsed;
  const ratio = timeRemaining / timeLimitSeconds;
  return Math.round(basePoints * (0.5 + 0.5 * ratio));
}

// ─── Internal Mutations (Cron Jobs) ─────────────────────────────────

/** Cleanup expired participant tokens (runs hourly) */
export const cleanupExpiredTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredParticipants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_expiration")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .take(100);

    for (const participant of expiredParticipants) {
      const session = await ctx.db.get(participant.sessionId);
      if (session?.status === "finished") {
        await ctx.db.patch(participant._id, { expiresAt: undefined });
        continue;
      }
      await ctx.db.delete(participant._id);
    }

    return { deleted: expiredParticipants.length };
  },
});

/** Cleanup old rate limit records (runs every 6 hours) */
export const cleanupOldRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    const oldRecords = await ctx.db
      .query("rateLimits")
      .filter((q) => q.lt(q.field("windowStart"), cutoff))
      .take(100);

    for (const record of oldRecords) {
      await ctx.db.delete(record._id);
    }

    return { deleted: oldRecords.length };
  },
});
