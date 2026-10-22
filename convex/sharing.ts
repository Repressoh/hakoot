import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { getImageView } from "./images";
import {
  checkRateLimit,
  deleteSession,
  generateInviteCode,
  generateToken,
  hashToken,
} from "./sessions";

/** A share token is this many random bytes, hex-encoded. */
const SHARE_TOKEN_BYTES = 16;
const SHARE_TOKEN_LENGTH = SHARE_TOKEN_BYTES * 2;

/** Sessions ended per run when a share link is turned off or reset. */
const END_BATCH_SIZE = 100;

/** A lobby started from a share link is deleted if nobody started the game this long after. */
const ABANDONED_LOBBY_MS = 24 * 60 * 60 * 1000;
/** Abandoned lobbies deleted per run (each schedules the deletion of its rows). */
const CLEANUP_BATCH_SIZE = 100;

const sharedStepValidator = v.object({
  _id: v.id("gameSteps"),
  choices: v.optional(
    v.array(v.object({ isCorrect: v.boolean(), text: v.string() }))
  ),
  codeBlock: v.optional(
    v.object({
      annotations: v.array(
        v.object({
          explanation: v.string(),
          label: v.string(),
          lines: v.array(v.number()),
          linesText: v.optional(v.string()),
        })
      ),
      code: v.string(),
      language: v.string(),
    })
  ),
  image: v.union(
    v.object({
      alt: v.string(),
      height: v.number(),
      key: v.string(),
      type: v.string(),
      url: v.string(),
      width: v.number(),
    }),
    v.null()
  ),
  markdownContent: v.optional(v.string()),
  question: v.optional(v.string()),
  timeLimitSeconds: v.optional(v.number()),
  type: v.union(v.literal("theory"), v.literal("quiz")),
});

/** The game whose enabled share link is `shareToken`, or null. */
async function getSharedGameDoc(ctx: QueryCtx, shareToken: string) {
  if (shareToken.length !== SHARE_TOKEN_LENGTH) {
    return null;
  }
  const game = await ctx.db
    .query("games")
    .withIndex("by_share_token", (q) => q.eq("shareToken", shareToken))
    .unique();
  return game?.shareEnabled === true ? game : null;
}

/** Throws unless the current user owns `gameId`; returns the game. */
async function requireOwnedGame(ctx: MutationCtx, gameId: Id<"games">) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Unauthorized");
  }
  const game = await ctx.db.get(gameId);
  if (!game || game.createdById !== userId) {
    throw new ConvexError("Not found");
  }
  return game;
}

/**
 * Move `game`'s share link to a new generation, optionally with a new token, and end in the
 * background the sessions started from its current token so far. Their hosts lose access at once
 * (see `isShareLinkActive`); ending them moves their players to the end screen.
 */
async function revokeLinkSessions(
  ctx: MutationCtx,
  game: Doc<"games">,
  patch: { shareEnabled?: false; shareToken?: string }
) {
  const shareGeneration = (game.shareGeneration ?? 0) + 1;
  await ctx.db.patch(game._id, { ...patch, shareGeneration });
  if (game.shareToken !== undefined) {
    await ctx.scheduler.runAfter(0, internal.sharing.endLinkSessions, {
      shareGeneration,
      shareToken: game.shareToken,
    });
  }
}

// ─── Queries ────────────────────────────────────────────────────────────

/** What the share page shows of the game behind `shareToken`, or null if the link doesn't work. */
export const getSharedGame = query({
  args: { shareToken: v.string() },
  handler: async (ctx, args) => {
    const game = await getSharedGameDoc(ctx, args.shareToken);
    if (!game) {
      return null;
    }

    const steps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    return {
      description: game.description ?? null,
      quizCount: steps.filter((step) => step.type === "quiz").length,
      stepCount: steps.length,
      title: game.title,
    };
  },
});

/** Read-only lesson content, in play order. Every page requires an active share link. */
export const getSharedGameSteps = query({
  args: { paginationOpts: paginationOptsValidator, shareToken: v.string() },
  handler: async (ctx, args) => {
    const game = await getSharedGameDoc(ctx, args.shareToken);
    if (!game) {
      return { continueCursor: "", isDone: true, page: [] };
    }

    const result = await ctx.db
      .query("gameSteps")
      .withIndex("by_game_and_order", (q) => q.eq("gameId", game._id))
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (step) => ({
          _id: step._id,
          choices: step.choices,
          codeBlock: step.codeBlock,
          image: await getImageView(ctx, step.image),
          markdownContent: step.markdownContent,
          question: step.question,
          timeLimitSeconds: step.timeLimitSeconds,
          type: step.type,
        }))
      ),
    };
  },
  returns: paginationResultValidator(sharedStepValidator),
});

// ─── Mutations ──────────────────────────────────────────────────────────

/**
 * Turn one of the current user's games' share link on or off. The link is created the first time;
 * turning it back on restores the same link. Turning it off ends the sessions started from it.
 */
export const setShareEnabled = mutation({
  args: { enabled: v.boolean(), gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await requireOwnedGame(ctx, args.gameId);

    if (args.enabled) {
      await ctx.db.patch(game._id, {
        shareEnabled: true,
        shareToken: game.shareToken ?? generateToken(SHARE_TOKEN_BYTES),
      });
      return null;
    }

    if (game.shareEnabled === true) {
      await revokeLinkSessions(ctx, game, { shareEnabled: false });
    }
    return null;
  },
});

/** Replace a game's share link with a new one; the old link stops working and its sessions end. */
export const resetShareLink = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await requireOwnedGame(ctx, args.gameId);
    await revokeLinkSessions(ctx, game, {
      shareToken: generateToken(SHARE_TOKEN_BYTES),
    });
    return null;
  },
});

/**
 * Start a session of the game behind a share link. Its signed-in owner gets an ordinary session;
 * anyone else, signed in or not, gets a host token, which only works while the link does.
 */
export const hostSharedGame = mutation({
  args: { shareToken: v.string() },
  handler: async (ctx, args) => {
    const game = await getSharedGameDoc(ctx, args.shareToken);
    if (!game) {
      throw new ConvexError("Link not found");
    }
    await checkRateLimit(ctx, `link:${game._id}`, "hostFromLink");

    const session = {
      answerRevealed: false,
      currentStepIndex: -1,
      gameId: game._id,
      inviteCode: generateInviteCode(),
      status: "waiting" as const,
    };

    const userId = await getAuthUserId(ctx);
    if (userId === game.createdById) {
      const sessionId = await ctx.db.insert("gameSessions", {
        ...session,
        hostId: userId,
      });
      return { hostToken: null, sessionId };
    }

    const hostToken = generateToken();
    const sessionId = await ctx.db.insert("gameSessions", {
      ...session,
      hostTokenHash: await hashToken(hostToken),
      shareGeneration: game.shareGeneration ?? 0,
      shareToken: args.shareToken,
    });
    return { hostToken, sessionId };
  },
});

/** Copy the game behind a share link, with its steps, into the current user's games. */
export const copySharedGame = mutation({
  args: { shareToken: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }
    const game = await getSharedGameDoc(ctx, args.shareToken);
    if (!game) {
      throw new ConvexError("Link not found");
    }
    await checkRateLimit(ctx, `user:${userId}`, "copyGame");

    const steps = await ctx.db
      .query("gameSteps")
      .withIndex("by_game_and_order", (q) => q.eq("gameId", game._id))
      .collect();

    // The copy is the user's own game: private until they share it.
    const gameId = await ctx.db.insert("games", {
      createdById: userId,
      description: game.description,
      title: game.title,
      updatedAt: Date.now(),
    });
    await Promise.all(
      steps.map((step, order) =>
        ctx.db.insert("gameSteps", {
          choices: step.choices,
          codeBlock: step.codeBlock,
          gameId,
          // Shares the original's file: it is deleted once neither shows it.
          image: step.image,
          markdownContent: step.markdownContent,
          order,
          question: step.question,
          timeLimitSeconds: step.timeLimitSeconds,
          type: step.type,
        })
      )
    );

    return gameId;
  },
});

// ─── Internal mutations ─────────────────────────────────────────────────

/**
 * End the unfinished sessions started from `shareToken` in a generation before `shareGeneration`,
 * a batch at a time. Those started after the link was turned back on keep running.
 */
export const endLinkSessions = internalMutation({
  args: { shareGeneration: v.number(), shareToken: v.string() },
  handler: async (ctx, args) => {
    const batches = await Promise.all(
      (["waiting", "in_progress"] as const).map((status) =>
        ctx.db
          .query("gameSessions")
          .withIndex("by_share_token_and_status_and_share_generation", (q) =>
            q
              .eq("shareToken", args.shareToken)
              .eq("status", status)
              .lt("shareGeneration", args.shareGeneration)
          )
          .take(END_BATCH_SIZE)
      )
    );

    await Promise.all(
      batches
        .flat()
        .map((session) => ctx.db.patch(session._id, { status: "finished" }))
    );

    if (batches.some((batch) => batch.length === END_BATCH_SIZE)) {
      await ctx.scheduler.runAfter(0, internal.sharing.endLinkSessions, args);
    }
    return null;
  },
});

/**
 * Delete lobbies started from a share link that never started (runs hourly), a batch at a time.
 * Anyone with the link can open one, so they would otherwise pile up.
 */
export const cleanupAbandonedLinkSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("gameSessions")
      .withIndex("by_host_and_status", (q) =>
        q
          .eq("hostId", undefined)
          .eq("status", "waiting")
          .lt("_creationTime", Date.now() - ABANDONED_LOBBY_MS)
      )
      .take(CLEANUP_BATCH_SIZE);

    // Gone at once, so the game can't start halfway through the deletion of
    // its players.
    await Promise.all(
      sessions.map((session) => deleteSession(ctx, session._id))
    );

    if (sessions.length === CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.sharing.cleanupAbandonedLinkSessions,
        {}
      );
    }
    return { deleted: sessions.length };
  },
});
