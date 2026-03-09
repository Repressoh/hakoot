import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Generate a random alphanumeric invite code */
function generateInviteCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

/** Generate a cryptographically random token */
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

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

    let currentAnswer = null;
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

    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    participants.sort((a, b) => b.totalScore - a.totalScore);

    const steps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", session.gameId))
      .collect();
    steps.sort((a, b) => a.order - b.order);

    const allAnswers: Array<{
      participantId: string;
      stepId: string;
      choiceIndex: number;
      isCorrect: boolean;
      score: number;
    }> = [];

    for (const p of participants) {
      const answers = await ctx.db
        .query("participantAnswers")
        .withIndex("by_participant", (q) => q.eq("participantId", p._id))
        .collect();
      for (const a of answers) {
        allAnswers.push({
          participantId: a.participantId,
          stepId: a.stepId,
          choiceIndex: a.choiceIndex,
          isCorrect: a.isCorrect,
          score: a.score,
        });
      }
    }

    return { session, participants, steps, answers: allAnswers };
  },
});

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
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Session not found");
    }
    if (session.status === "finished") {
      throw new ConvexError("Session has ended");
    }

    // Rejoin with existing token
    if (args.existingToken) {
      const existing = await ctx.db
        .query("gameParticipants")
        .withIndex("by_token", (q) =>
          q.eq("participantToken", args.existingToken!)
        )
        .first();
      if (existing && existing.sessionId === args.sessionId) {
        await ctx.db.patch(existing._id, { lastSeen: Date.now() });
        return {
          participantId: existing._id,
          participantToken: existing.participantToken,
        };
      }
    }

    const token = generateToken();

    const participantId = await ctx.db.insert("gameParticipants", {
      sessionId: args.sessionId,
      name: args.name.trim(),
      email: args.email,
      participantToken: token,
      totalScore: 0,
      lastSeen: Date.now(),
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
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("gameSessions")
      .withIndex("by_invite_code", (q) =>
        q.eq("inviteCode", args.inviteCode.toUpperCase().trim())
      )
      .first();

    if (!session) {
      throw new ConvexError("Invalid invite code");
    }
    if (session.status === "finished") {
      throw new ConvexError("Session has ended");
    }

    // Rejoin with existing token
    if (args.existingToken) {
      const existing = await ctx.db
        .query("gameParticipants")
        .withIndex("by_token", (q) =>
          q.eq("participantToken", args.existingToken!)
        )
        .first();
      if (existing && existing.sessionId === session._id) {
        await ctx.db.patch(existing._id, { lastSeen: Date.now() });
        return {
          sessionId: session._id,
          participantToken: existing.participantToken,
        };
      }
    }

    const token = generateToken();

    await ctx.db.insert("gameParticipants", {
      sessionId: session._id,
      name: args.name.trim(),
      participantToken: token,
      totalScore: 0,
      lastSeen: Date.now(),
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

    await ctx.db.patch(args.sessionId, {
      status: "in_progress",
      currentStepIndex: nextIndex,
      stepStartedAt: hasTimer ? Date.now() : undefined,
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
    if (!currentStep || currentStep.type !== "quiz") {
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
          totalScore: p.totalScore + answer.score,
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
    if (!session || session.status !== "in_progress") {
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

    const steps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", session.gameId))
      .collect();
    steps.sort((a, b) => a.order - b.order);

    const currentStep = steps[session.currentStepIndex];
    if (!currentStep || currentStep.type !== "quiz") {
      throw new ConvexError("Not a quiz step");
    }

    if (session.answerRevealed) {
      throw new ConvexError("Answer already revealed");
    }

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
      // Auto-reveal: apply scores
      for (const p of participants) {
        const answer = await ctx.db
          .query("participantAnswers")
          .withIndex("by_participant_and_step", (q) =>
            q.eq("participantId", p._id).eq("stepId", currentStep._id)
          )
          .first();
        if (answer) {
          await ctx.db.patch(p._id, {
            totalScore: p.totalScore + answer.score,
          });
        }
      }
      await ctx.db.patch(args.sessionId, { answerRevealed: true });
    }

    return { isCorrect, score };
  },
});

/** Compute Kahoot-style score */
function computeScore(
  isCorrect: boolean,
  timeLimitSeconds: number | null,
  answeredAtMs: number,
  stepStartedAtMs: number,
  basePoints = 1000
): number {
  if (!isCorrect) {
    return 0;
  }
  if (!timeLimitSeconds) {
    return basePoints;
  }

  const elapsed = (answeredAtMs - stepStartedAtMs) / 1000;
  if (elapsed >= timeLimitSeconds) {
    return 0;
  }

  const timeRemaining = timeLimitSeconds - elapsed;
  const ratio = timeRemaining / timeLimitSeconds;
  return Math.round(basePoints * (0.5 + 0.5 * ratio));
}
