import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { getImageView } from "./images";

/** Generate a random alphanumeric invite code */
export function generateInviteCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

/** Hex-encode bytes. */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generate a cryptographically random token of `byteLength` bytes, hex-encoded. */
export function generateToken(byteLength = 32): string {
  const array = new Uint8Array(byteLength);
  crypto.getRandomValues(array);
  return toHex(array);
}

/** SHA-256 of `token`, hex-encoded: what is stored of a host token. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return toHex(new Uint8Array(digest));
}

/**
 * Whether the share link `session` was started from still works: sharing is on, and the link
 * wasn't reset or turned off since (which also ends the session, a moment later).
 */
function isShareLinkActive(
  game: Doc<"games"> | null,
  session: Doc<"gameSessions">
): boolean {
  return (
    game?.shareEnabled === true &&
    session.shareToken !== undefined &&
    game.shareToken === session.shareToken &&
    (game.shareGeneration ?? 0) === session.shareGeneration
  );
}

/** The longest an email address can be (RFC 5321). */
const MAX_EMAIL_LENGTH = 254;

/** Rate limiting configuration */
const RATE_LIMIT_CONFIG = {
  copyGame: { maxAttempts: 10, windowMs: 60_000 },
  hostFromLink: { maxAttempts: 30, windowMs: 60_000 },
  join: { maxAttempts: 10, windowMs: 60_000 },
  joinByCode: { maxAttempts: 10, windowMs: 60_000 },
  uploadImage: { maxAttempts: 20, windowMs: 60_000 },
} as const;

/** Check and enforce rate limiting */
export async function checkRateLimit(
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
      attempts: 1,
      endpoint,
      identifier,
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

/** Stale threshold: participants unseen for this long are removed in lobby */
const STALE_THRESHOLD_MS = 15_000; // 15 seconds

/**
 * Whether a participant has stopped sending heartbeats: last seen (from `lastSeen`, by
 * participant, else the participant's legacy `lastSeen` field) over STALE_THRESHOLD_MS ago, or
 * never.
 */
function isStale(
  participant: Doc<"gameParticipants">,
  lastSeen: Map<Id<"gameParticipants">, number>,
  now: number
): boolean {
  const seen = lastSeen.get(participant._id) ?? participant.lastSeen;
  return seen === undefined || now - seen > STALE_THRESHOLD_MS;
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

    // Sessions started from the share link belong to whoever started them.
    return await ctx.db
      .query("gameSessions")
      .withIndex("by_game_and_host", (q) =>
        q.eq("gameId", args.gameId).eq("hostId", userId)
      )
      .order("desc")
      .collect();
  },
});

/**
 * Session, game, steps and participants for the session's host. In the lobby, only players seen in
 * the last 15 seconds are listed.
 *
 * @deprecated Replaced by `getHostView` and `listHostParticipants`, which send far less on every
 * change. Kept so host screens opened before the switch keep working; remove in a later release.
 */
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

    const [game, steps, allParticipants] = await Promise.all([
      ctx.db.get(session.gameId),
      getOrderedSteps(ctx, session.gameId),
      ctx.db
        .query("gameParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
    ]);
    // A deleted game's sessions are deleted in the background.
    if (!game) {
      return null;
    }

    // In the waiting lobby, hide participants who stopped sending heartbeats
    let participants = allParticipants;
    if (session.status === "waiting") {
      const lastSeen = await getLastSeenByParticipant(ctx, args.sessionId);
      const now = Date.now();
      participants = allParticipants.filter((p) => !isStale(p, lastSeen, now));
    }

    return { game, participants, session, steps };
  },
});

/** A game's steps in play order. */
async function getOrderedSteps(ctx: QueryCtx, gameId: Id<"games">) {
  return await ctx.db
    .query("gameSteps")
    .withIndex("by_game_and_order", (q) => q.eq("gameId", gameId))
    .collect();
}

/**
 * The session if the caller hosts it, otherwise null. The game's owner hosts the sessions they
 * start signed in. A session started from the share link is hosted by whoever holds its host
 * token, and only while that link still works. Nobody hosts a session of a deleted game, whose
 * sessions are being deleted in the background.
 */
async function getHostedSession(
  ctx: QueryCtx,
  sessionId: Id<"gameSessions">,
  hostToken: string | undefined
) {
  const session = await ctx.db.get(sessionId);
  if (!session) {
    return null;
  }
  const game = await ctx.db.get(session.gameId);
  if (!game) {
    return null;
  }
  if (session.hostId !== undefined) {
    const userId = await getAuthUserId(ctx);
    return userId === session.hostId ? session : null;
  }
  if (
    hostToken === undefined ||
    session.hostTokenHash === undefined ||
    (await hashToken(hostToken)) !== session.hostTokenHash
  ) {
    return null;
  }
  return isShareLinkActive(game, session) ? session : null;
}

/**
 * Throws unless players can join `session`: it isn't over, its game still exists and, if it was
 * started from a share link, that link still works.
 */
async function assertJoinable(ctx: QueryCtx, session: Doc<"gameSessions">) {
  if (session.status === "finished") {
    throw new ConvexError("Session has ended");
  }
  const game = await ctx.db.get(session.gameId);
  if (
    !game ||
    (session.hostId === undefined && !isShareLinkActive(game, session))
  ) {
    throw new ConvexError("Session has ended");
  }
}

/** Host token argument: required for sessions started from a share link. */
const hostTokenArg = v.optional(v.string());

/**
 * The host screen: session state, game title, step count and only the current step's content.
 * It doesn't read participants, so joins, answers and heartbeats don't re-send it; the
 * participant list is `listHostParticipants`.
 */
export const getHostView = query({
  args: { hostToken: hostTokenArg, sessionId: v.id("gameSessions") },
  handler: async (ctx, args) => {
    const session = await getHostedSession(ctx, args.sessionId, args.hostToken);
    if (!session) {
      return null;
    }

    const [game, steps] = await Promise.all([
      ctx.db.get(session.gameId),
      getOrderedSteps(ctx, session.gameId),
    ]);
    const step = steps[session.currentStepIndex];

    return {
      codeLanguages: getCodeLanguages(steps),
      currentStep: step
        ? {
            _id: step._id,
            choices: step.choices,
            codeBlock: step.codeBlock
              ? { code: step.codeBlock.code, language: step.codeBlock.language }
              : undefined,
            image: await getImageView(ctx, step.image),
            markdownContent: step.markdownContent,
            question: step.question,
            timeLimitSeconds: step.timeLimitSeconds,
            type: step.type,
          }
        : null,
      gameTitle: game?.title ?? "",
      session: {
        _id: session._id,
        answerRevealed: session.answerRevealed,
        currentStepIndex: session.currentStepIndex,
        inviteCode: session.inviteCode,
        status: session.status,
        stepStartedAt: session.stepStartedAt,
      },
      stepCount: steps.length,
    };
  },
});

/**
 * The session's participants for its host. In the lobby, only players seen in the last 15 seconds
 * are listed.
 *
 * Convex re-runs a query when data it read changes, not as time passes, so in the lobby the host
 * screen passes a `clock` that changes every few seconds: otherwise a player who left would stay
 * listed until someone else's heartbeat re-ran the query. Its value isn't used: the check uses the
 * server's time.
 */
export const listHostParticipants = query({
  args: {
    clock: v.optional(v.number()),
    hostToken: hostTokenArg,
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => {
    const session = await getHostedSession(ctx, args.sessionId, args.hostToken);
    if (!session) {
      return [];
    }

    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    let visible = participants;
    // Only the lobby reads presence, so heartbeats don't re-run this query
    // once the game has started.
    if (session.status === "waiting") {
      const lastSeen = await getLastSeenByParticipant(ctx, args.sessionId);
      const now = Date.now();
      visible = participants.filter((p) => !isStale(p, lastSeen, now));
    }

    return visible.map((p) => ({
      _id: p._id,
      name: p.name,
      totalScore: p.totalScore,
    }));
  },
});

/** Last heartbeat time per participant of a session. */
async function getLastSeenByParticipant(
  ctx: QueryCtx,
  sessionId: Id<"gameSessions">
) {
  const presence = await ctx.db
    .query("participantPresence")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  return new Map(presence.map((p) => [p.participantId, p.lastSeen]));
}

/** Record that a lobby player is still connected. */
async function touchPresence(
  ctx: MutationCtx,
  participantId: Id<"gameParticipants">,
  sessionId: Id<"gameSessions">
) {
  const presence = await ctx.db
    .query("participantPresence")
    .withIndex("by_participant", (q) => q.eq("participantId", participantId))
    .unique();
  if (presence) {
    await ctx.db.patch(presence._id, { lastSeen: Date.now() });
  } else {
    await ctx.db.insert("participantPresence", {
      lastSeen: Date.now(),
      participantId,
      sessionId,
    });
  }
}

/** Look up a session that can still be joined (not finished) by its invite code. */
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

    // A deleted game's sessions are deleted in the background.
    const game = await ctx.db.get(session.gameId);
    if (!game) {
      return null;
    }
    return {
      gameTitle: game.title,
      inviteCode: session.inviteCode,
      sessionId: session._id,
      status: session.status,
    };
  },
});

/** Get full session state for a participant (reactive!) */
export const getPlayerState = query({
  args: {
    participantToken: v.string(),
    sessionId: v.id("gameSessions"),
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

    const [game, steps] = await Promise.all([
      ctx.db.get(session.gameId),
      getOrderedSteps(ctx, session.gameId),
    ]);
    // A deleted game's sessions are deleted in the background.
    if (!game) {
      return null;
    }

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
      // Lets the client preload syntax highlighting before a code step shows.
      codeLanguages: getCodeLanguages(steps),
      currentAnswer,
      currentStep: currentStep
        ? {
            choices: currentStep.choices ?? null,
            codeBlock: currentStep.codeBlock ?? null,
            id: currentStep._id,
            image: await getImageView(ctx, currentStep.image),
            markdownContent: currentStep.markdownContent ?? null,
            order: currentStep.order,
            question: currentStep.question ?? null,
            timeLimitSeconds: currentStep.timeLimitSeconds ?? null,
            type: currentStep.type,
          }
        : null,
      participant: {
        id: participant._id,
        name: participant.name,
        totalScore: participant.totalScore,
      },
      session: {
        answerRevealed: session.answerRevealed,
        currentStepIndex: session.currentStepIndex,
        gameTitle: game.title,
        id: session._id,
        status: session.status,
        stepStartedAt: session.stepStartedAt ?? null,
        totalSteps: steps.length,
      },
    };
  },
});

/** The distinct languages of the steps' code blocks. */
function getCodeLanguages(steps: Doc<"gameSteps">[]): string[] {
  return [
    ...new Set(
      steps.flatMap((step) => (step.codeBlock ? [step.codeBlock.language] : []))
    ),
  ];
}

/** Get answer count for host view (reactive!) */
export const getAnswerCount = query({
  args: { hostToken: hostTokenArg, sessionId: v.id("gameSessions") },
  handler: async (ctx, args) => {
    const session = await getHostedSession(ctx, args.sessionId, args.hostToken);
    if (!session) {
      return null;
    }

    const steps = await getOrderedSteps(ctx, session.gameId);

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
    const answered = await countStepAnswers(
      ctx,
      args.sessionId,
      currentStep._id,
      participants
    );

    return { answered, total: participants.length };
  },
});

/**
 * How many of `participants` answered `stepId` in `sessionId`. Only reads this session's answers
 * (and any saved before answers had a session id): the step's answers from every other session of
 * the game, including those started from its share link, could be far too many to read.
 */
async function countStepAnswers(
  ctx: QueryCtx,
  sessionId: Id<"gameSessions">,
  stepId: Id<"gameSteps">,
  participants: Array<{ _id: Id<"gameParticipants"> }>
) {
  const [answers, legacyAnswers] = await Promise.all(
    [sessionId, undefined].map((answerSessionId) =>
      ctx.db
        .query("participantAnswers")
        .withIndex("by_session_and_step", (q) =>
          q.eq("sessionId", answerSessionId).eq("stepId", stepId)
        )
        .collect()
    )
  );
  const participantIds = new Set(participants.map((p) => p._id));
  return [...answers, ...legacyAnswers].filter((answer) =>
    participantIds.has(answer.participantId)
  ).length;
}

/**
 * Get session results for host.
 *
 * @deprecated Replaced by `getResultsView`, which leaves out step content and unused fields. Kept
 * so results screens opened before the switch keep working; remove in a later release.
 */
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

    const [storedParticipants, steps] = await Promise.all([
      ctx.db
        .query("gameParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      getOrderedSteps(ctx, session.gameId),
    ]);

    const { answers: allAnswers, restoredParticipants } =
      await collectResultAnswers(ctx, session, steps, storedParticipants);

    const participants = [...storedParticipants, ...restoredParticipants];
    participants.sort((a, b) => b.totalScore - a.totalScore);

    return { answers: allAnswers, participants, session, steps };
  },
});

/**
 * Results of a session for its host, with only the fields the results screen and CSV export use:
 * quiz steps (no theory content), slim answers and participants (no tokens).
 */
export const getResultsView = query({
  args: { hostToken: hostTokenArg, sessionId: v.id("gameSessions") },
  handler: async (ctx, args) => {
    const session = await getHostedSession(ctx, args.sessionId, args.hostToken);
    if (!session) {
      return null;
    }

    const [storedParticipants, steps] = await Promise.all([
      ctx.db
        .query("gameParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      getOrderedSteps(ctx, session.gameId),
    ]);

    const { answers, restoredParticipants } = await collectResultAnswers(
      ctx,
      session,
      steps,
      storedParticipants
    );

    const participants = [
      ...storedParticipants.map(({ _id, email, name, totalScore }) => ({
        _id,
        email,
        name,
        totalScore,
      })),
      ...restoredParticipants.map(({ _id, name, totalScore }) => ({
        _id,
        email: undefined,
        name,
        totalScore,
      })),
    ];
    participants.sort((a, b) => b.totalScore - a.totalScore);

    return {
      answers: answers.map((a) => ({
        choiceIndex: a.choiceIndex,
        isCorrect: a.isCorrect,
        participantId: a.participantId,
        score: a.score,
        stepId: a.stepId,
      })),
      gameId: session.gameId,
      participants,
      quizSteps: steps
        .filter((step) => step.type === "quiz")
        .map((step) => ({
          _id: step._id,
          choices: step.choices ?? [],
          question: step.question ?? "",
        })),
      // Set for a session started from the share link: its host goes back
      // to the share page instead of the game's sessions.
      shareToken: session.shareToken ?? null,
      stepCount: steps.length,
    };
  },
});

async function collectResultAnswers(
  ctx: QueryCtx,
  session: Doc<"gameSessions">,
  steps: Doc<"gameSteps">[],
  storedParticipants: Doc<"gameParticipants">[]
) {
  const sessionAnswers = await ctx.db
    .query("participantAnswers")
    .withIndex("by_session_and_step", (q) => q.eq("sessionId", session._id))
    .collect();

  // Sessions started from a share link are newer than answers saved without
  // a session id, and their host isn't the owner of the game's other
  // sessions, so they never fall back to reading answers by step.
  if (sessionAnswers.length > 0 || session.hostId === undefined) {
    // A removed step's answers are deleted in the background.
    const stepIds = new Set(steps.map((step) => step._id));
    return {
      answers: sessionAnswers.filter((answer) => stepIds.has(answer.stepId)),
      restoredParticipants: [] as RestoredParticipant[],
    };
  }

  return await collectLegacyResultAnswers(
    ctx,
    session._id,
    steps,
    storedParticipants
  );
}

/**
 * Results fallback for older sessions whose answers have no session id: gather those answers by
 * step and total the scores of participants that no longer exist.
 */
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

  // Only answers without a session id: any other answer belongs to another
  // session, since this one has none.
  const answersByStep = await Promise.all(
    steps
      .filter((step) => step.type === "quiz")
      .map((step) =>
        ctx.db
          .query("participantAnswers")
          .withIndex("by_session_and_step", (q) =>
            q.eq("sessionId", undefined).eq("stepId", step._id)
          )
          .collect()
      )
  );

  for (const stepAnswers of answersByStep) {
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

/**
 * Placeholder "Archived participant N" rows so deleted participants still appear in the results.
 */
function buildRestoredParticipants(
  sessionId: Id<"gameSessions">,
  scoreByMissingParticipant: Map<Id<"gameParticipants">, number>
): RestoredParticipant[] {
  return Array.from(
    scoreByMissingParticipant.entries(),
    ([participantId, totalScore], index) => ({
      _creationTime: 0,
      _id: participantId,
      name: `Archived participant ${index + 1}`,
      participantToken: "",
      sessionId,
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
      name: p.name,
      rank: i + 1,
      score: p.totalScore,
    }));
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────

/**
 * Open a new session (in the lobby, with a fresh invite code) for one of the current user's games.
 */
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
      answerRevealed: false,
      currentStepIndex: -1,
      gameId: args.gameId,
      hostId: userId,
      inviteCode,
      status: "waiting",
    });
  },
});

/** Join a session by id, or rejoin with an existing participant token. Rate-limited per session. */
export const join = mutation({
  args: {
    email: v.optional(v.string()),
    existingToken: v.optional(v.string()),
    name: v.string(),
    sessionId: v.id("gameSessions"),
  },
  handler: async (ctx, args) => {
    // Use session ID only to prevent bypass via name variation
    const identifier = `session:${args.sessionId}`;
    await checkRateLimit(ctx, identifier, "join");

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Session not found");
    }
    await assertJoinable(ctx, session);

    // Rejoin with existing token
    if (args.existingToken) {
      const { existingToken } = args;
      const existing = await ctx.db
        .query("gameParticipants")
        .withIndex("by_token", (q) => q.eq("participantToken", existingToken))
        .first();
      if (existing && existing.sessionId === args.sessionId) {
        // Check if token is expired
        if (existing.expiresAt && Date.now() > existing.expiresAt) {
          throw new ConvexError("Token expired. Please rejoin.");
        }
        if (session.status === "waiting") {
          await touchPresence(ctx, existing._id, session._id);
        }
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
    // No longer than an email address can be
    if (args.email !== undefined && args.email.length > MAX_EMAIL_LENGTH) {
      throw new ConvexError("Invalid email");
    }

    const token = generateToken();
    const expiresAt = Date.now() + TOKEN_EXPIRATION_MS;

    const participantId = await ctx.db.insert("gameParticipants", {
      email: args.email,
      expiresAt,
      name: sanitizedName,
      participantToken: token,
      sessionId: args.sessionId,
      totalScore: 0,
    });
    if (session.status === "waiting") {
      await touchPresence(ctx, participantId, session._id);
    }

    return { participantId, participantToken: token };
  },
});

/** Join a session by invite code (combines lookup + join in one call) */
export const joinByCode = mutation({
  args: {
    existingToken: v.optional(v.string()),
    inviteCode: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
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
    await assertJoinable(ctx, session);

    // Rejoin with existing token
    if (args.existingToken) {
      const { existingToken } = args;
      const existing = await ctx.db
        .query("gameParticipants")
        .withIndex("by_token", (q) => q.eq("participantToken", existingToken))
        .first();
      if (existing && existing.sessionId === session._id) {
        // Check if token is expired
        if (existing.expiresAt && Date.now() > existing.expiresAt) {
          throw new ConvexError("Token expired. Please rejoin.");
        }
        if (session.status === "waiting") {
          await touchPresence(ctx, existing._id, session._id);
        }
        return {
          participantToken: existing.participantToken,
          sessionId: session._id,
        };
      }
    }

    const sanitizedName = sanitizeInput(args.name, 50);
    if (!sanitizedName) {
      throw new ConvexError("Invalid name");
    }

    const token = generateToken();
    const expiresAt = Date.now() + TOKEN_EXPIRATION_MS;

    const participantId = await ctx.db.insert("gameParticipants", {
      expiresAt,
      name: sanitizedName,
      participantToken: token,
      sessionId: session._id,
      totalScore: 0,
    });
    if (session.status === "waiting") {
      await touchPresence(ctx, participantId, session._id);
    }

    return { participantToken: token, sessionId: session._id };
  },
});

/**
 * Heartbeat from a player in the lobby, so the host's lobby only lists connected players. Once
 * the game has started nothing reads it, so it isn't stored.
 */
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
    const session = await ctx.db.get(participant.sessionId);
    if (session?.status !== "waiting") {
      return;
    }
    await touchPresence(ctx, participant._id, participant.sessionId);
  },
});

/**
 * Host moves to the next step, or finishes after the last one. Starting from the lobby removes
 * stale players; timed quizzes get a 10-second reading phase.
 */
export const advance = mutation({
  args: { hostToken: hostTokenArg, sessionId: v.id("gameSessions") },
  handler: async (ctx, args) => {
    const session = await getHostedSession(ctx, args.sessionId, args.hostToken);
    if (!session) {
      throw new ConvexError("Not found");
    }
    if (session.status === "finished") {
      throw new ConvexError("Session has ended");
    }

    const steps = await getOrderedSteps(ctx, session.gameId);

    const nextIndex = session.currentStepIndex + 1;

    // When starting from lobby, remove stale participants. Presence is only
    // kept for the lobby, so it is cleared too.
    if (session.status === "waiting") {
      const [participants, presence] = await Promise.all([
        ctx.db
          .query("gameParticipants")
          .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
          .collect(),
        ctx.db
          .query("participantPresence")
          .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
          .collect(),
      ]);
      const lastSeen = new Map(
        presence.map((p) => [p.participantId, p.lastSeen])
      );
      const now = Date.now();
      const staleParticipants = participants.filter((p) =>
        isStale(p, lastSeen, now)
      );
      await Promise.all([
        ...staleParticipants.map((p) => ctx.db.delete(p._id)),
        ...presence.map((p) => ctx.db.delete(p._id)),
      ]);
    }

    if (nextIndex >= steps.length) {
      // Session is finished
      await ctx.db.patch(args.sessionId, {
        currentStepIndex: session.currentStepIndex,
        status: "finished",
      });
      return { status: "finished", stepIndex: session.currentStepIndex };
    }

    const nextStep = steps[nextIndex];
    const hasTimer = nextStep.type === "quiz" && nextStep.timeLimitSeconds;
    // Add 10-second reading phase before the answer timer starts
    const READING_PHASE_MS = 10_000;
    const timerStartsAt = hasTimer ? Date.now() + READING_PHASE_MS : undefined;

    await ctx.db.patch(args.sessionId, {
      answerRevealed: false,
      currentStepIndex: nextIndex,
      status: "in_progress",
      stepStartedAt: timerStartsAt,
    });

    return { status: "in_progress", stepIndex: nextIndex };
  },
});

/**
 * Host reveals the current quiz answer and adds this step's scores to the totals. Safe to call
 * twice.
 */
export const reveal = mutation({
  args: { hostToken: hostTokenArg, sessionId: v.id("gameSessions") },
  handler: async (ctx, args) => {
    const session = await getHostedSession(ctx, args.sessionId, args.hostToken);
    if (!session) {
      throw new ConvexError("Not found");
    }

    if (session.answerRevealed || session.status !== "in_progress") {
      return null; // Idempotent
    }

    const steps = await getOrderedSteps(ctx, session.gameId);

    const currentStep = steps[session.currentStepIndex];
    if (currentStep?.type !== "quiz") {
      return null;
    }

    // Apply scores to totalScore
    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    await applyStepScoresAndReveal(
      ctx,
      args.sessionId,
      participants,
      currentStep._id
    );
    return null;
  },
});

/**
 * Record and score a participant's answer to the current quiz step; reveals automatically once
 * everyone has answered.
 */
export const submitAnswer = mutation({
  args: {
    choiceIndex: v.number(),
    participantToken: v.string(),
    sessionId: v.id("gameSessions"),
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
      choiceIndex: args.choiceIndex,
      isCorrect,
      participantId: participant._id,
      score,
      sessionId: args.sessionId,
      stepId: currentStep._id,
    });

    // Check if all participants in THIS session have answered → auto-reveal
    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const sessionAnswerCount = await countStepAnswers(
      ctx,
      args.sessionId,
      currentStep._id,
      participants
    );

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

/** The session's current step; throws if it is not a quiz. */
async function getActiveQuizStep(
  ctx: MutationCtx,
  gameId: Id<"games">,
  session: {
    currentStepIndex: number;
  }
) {
  const steps = await getOrderedSteps(ctx, gameId);

  const currentStep = steps[session.currentStepIndex];
  if (currentStep?.type !== "quiz") {
    throw new ConvexError("Not a quiz step");
  }

  return currentStep;
}

/** Throws if the answer was already revealed or the reading phase has not ended yet. */
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

/**
 * Add each participant's score for `stepId` to their total (never below 0) and mark the answer
 * revealed.
 */
async function applyStepScoresAndReveal(
  ctx: MutationCtx,
  sessionId: Id<"gameSessions">,
  participants: Array<{ _id: Id<"gameParticipants">; totalScore: number }>,
  stepId: Id<"gameSteps">
) {
  await Promise.all(
    participants.map(async (participant) => {
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
    })
  );

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

/** Answers, and presence rows, `deleteSessionChildren` deletes per run. They are small. */
const CHILD_BATCH_SIZE = 500;
/**
 * Most bytes of players `deleteSessionChildren` reads per run, well under a transaction's 16 MiB.
 * Players who joined before emails were limited may carry an email of up to 1 MiB.
 */
const PLAYER_BATCH_BYTES = 4 * 1024 * 1024;

/**
 * Delete a session at once, so nobody can host, join or play it any more, and its players, their
 * presence rows and answers in the background, a bounded batch at a time.
 */
export async function deleteSession(
  ctx: MutationCtx,
  sessionId: Id<"gameSessions">
) {
  await ctx.db.delete(sessionId);
  await ctx.scheduler.runAfter(0, internal.sessions.deleteSessionChildren, {
    sessionId,
  });
}

/**
 * Delete a batch of a deleted session's answers, presence rows and players, then schedule itself
 * until none are left.
 */
export const deleteSessionChildren = internalMutation({
  args: { sessionId: v.id("gameSessions") },
  handler: async (ctx, { sessionId }) => {
    const [answers, presence, players] = await Promise.all([
      ctx.db
        .query("participantAnswers")
        .withIndex("by_session_and_step", (q) => q.eq("sessionId", sessionId))
        .take(CHILD_BATCH_SIZE),
      ctx.db
        .query("participantPresence")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .take(CHILD_BATCH_SIZE),
      // Bounded by size, not only by count: always returns at least one
      // player while any are left.
      ctx.db
        .query("gameParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .paginate({
          cursor: null,
          maximumBytesRead: PLAYER_BATCH_BYTES,
          numItems: CHILD_BATCH_SIZE,
        }),
    ]);

    await Promise.all(
      [...answers, ...presence, ...players.page].map((row) =>
        ctx.db.delete(row._id)
      )
    );

    if (
      answers.length === CHILD_BATCH_SIZE ||
      presence.length === CHILD_BATCH_SIZE ||
      !players.isDone
    ) {
      await ctx.scheduler.runAfter(0, internal.sessions.deleteSessionChildren, {
        sessionId,
      });
    }
    return null;
  },
});

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

    await Promise.all(
      expiredParticipants.map(async (participant) => {
        const session = await ctx.db.get(participant.sessionId);
        if (session?.status === "finished") {
          await ctx.db.patch(participant._id, { expiresAt: undefined });
          return;
        }
        const presence = await ctx.db
          .query("participantPresence")
          .withIndex("by_participant", (q) =>
            q.eq("participantId", participant._id)
          )
          .unique();
        await Promise.all([
          ctx.db.delete(participant._id),
          presence ? ctx.db.delete(presence._id) : undefined,
        ]);
      })
    );

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

    await Promise.all(oldRecords.map((record) => ctx.db.delete(record._id)));

    return { deleted: oldRecords.length };
  },
});
