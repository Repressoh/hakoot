/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

/** A share token: 16 random bytes, hex-encoded. */
const SHARE_TOKEN = /^[0-9a-f]{32}$/;
/** A host token, or a SHA-256 hash: 32 bytes, hex-encoded. */
const HEX_32_BYTES = /^[0-9a-f]{64}$/;

/**
 * A fresh in-memory Convex backend for one test, enforcing a deployment's per-transaction limits
 * (documents read and written, index ranges, scheduled functions).
 */
function newTest() {
  return convexTest({ modules, schema, transactionLimits: true });
}

type TestConvex = ReturnType<typeof newTest>;

/** Run `fn` `times` times, one after the other. */
async function repeat(times: number, fn: () => Promise<unknown>) {
  if (times > 0) {
    await fn();
    await repeat(times - 1, fn);
  }
}

/** A signed-in user. @convex-dev/auth reads the user from `subject`. */
async function signUp(t: TestConvex, email: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert("users", { email })
  );
  return { as: t.withIdentity({ subject: `${userId}|session` }), userId };
}

/** A game owned by `ownerId` with a theory step, an annotated code step and a timed quiz. */
async function seedGame(t: TestConvex, ownerId: Id<"users">) {
  return await t.run(async (ctx) => {
    const gameId = await ctx.db.insert("games", {
      createdById: ownerId,
      description: "Learn the basics",
      title: "Intro to TypeScript",
      updatedAt: 0,
    });
    // Inserted out of play order: copies must follow `order`.
    await ctx.db.insert("gameSteps", {
      choices: [
        { isCorrect: false, text: "string" },
        { isCorrect: true, text: "number" },
      ],
      gameId,
      order: 2,
      question: "Type of 1?",
      timeLimitSeconds: 20,
      type: "quiz",
    });
    await ctx.db.insert("gameSteps", {
      gameId,
      markdownContent: "# Types",
      order: 0,
      type: "theory",
    });
    await ctx.db.insert("gameSteps", {
      codeBlock: {
        annotations: [
          {
            explanation: "A number",
            label: "n",
            lines: [1],
            linesText: "1",
          },
        ],
        code: "const n = 1;",
        language: "typescript",
      },
      gameId,
      markdownContent: "Code",
      order: 1,
      type: "theory",
    });
    return gameId;
  });
}

/** An owner with a game whose share link is on; returns the link's token. */
async function seedSharedGame(t: TestConvex) {
  const owner = await signUp(t, "owner@x.test");
  const gameId = await seedGame(t, owner.userId);
  await owner.as.mutation(api.sharing.setShareEnabled, {
    enabled: true,
    gameId,
  });
  const shareToken = await currentShareToken(owner.as, gameId);
  return { gameId, owner, shareToken };
}

async function currentShareToken(
  owner: ReturnType<TestConvex["withIdentity"]>,
  gameId: Id<"games">
) {
  const view = await owner.query(api.games.getEditorView, { gameId });
  if (!view?.shareToken) {
    throw new Error("sharing is off");
  }
  return view.shareToken;
}

/** The quiz step of a game seeded by `seedGame`. */
async function getQuizStepId(t: TestConvex, gameId: Id<"games">) {
  const quiz = await t.run(async (ctx) =>
    (
      await ctx.db
        .query("gameSteps")
        .withIndex("by_game", (q) => q.eq("gameId", gameId))
        .collect()
    ).find((step) => step.type === "quiz")
  );
  if (!quiz) {
    throw new Error("seedGame should create a quiz");
  }
  return quiz._id;
}

async function getSession(t: TestConvex, sessionId: Id<"gameSessions">) {
  return await t.run(async (ctx) => await ctx.db.get(sessionId));
}

/** Advance the test clock to the quiz's persisted answer start time. */
async function finishReadingPhase(
  t: TestConvex,
  sessionId: Id<"gameSessions">
) {
  const session = await getSession(t, sessionId);
  if (session?.stepStartedAt === undefined) {
    throw new Error("expected a timed quiz");
  }
  // Convex transaction time can run ahead of a frozen test clock.
  vi.advanceTimersByTime(Math.max(0, session.stepStartedAt - Date.now()));
}

/** Join a session as a player by its invite code. */
async function joinAs(
  t: TestConvex,
  sessionId: Id<"gameSessions">,
  name: string
) {
  const session = await getSession(t, sessionId);
  if (!session) {
    throw new Error("no session");
  }
  const { participantToken } = await t.mutation(api.sessions.joinByCode, {
    inviteCode: session.inviteCode,
    name,
  });
  return participantToken;
}

/** Add `count` players, each with a presence row, straight to the database. */
async function seedPlayers(
  t: TestConvex,
  sessionId: Id<"gameSessions">,
  count: number
) {
  await t.run(async (ctx) => {
    await Promise.all(
      Array.from({ length: count }, async (_, i) => {
        const participantId = await ctx.db.insert("gameParticipants", {
          name: `Player ${i}`,
          participantToken: `${sessionId}-${i}`,
          sessionId,
          totalScore: 0,
        });
        await ctx.db.insert("participantPresence", {
          lastSeen: 0,
          participantId,
          sessionId,
        });
      })
    );
  });
}

/** How many players, presence rows and answers `sessionId` has. */
async function countSessionRows(t: TestConvex, sessionId: Id<"gameSessions">) {
  return await t.run(async (ctx) => {
    const lists = await Promise.all([
      ctx.db
        .query("gameParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect(),
      ctx.db
        .query("participantPresence")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect(),
      ctx.db
        .query("participantAnswers")
        .withIndex("by_session_and_step", (q) => q.eq("sessionId", sessionId))
        .collect(),
    ]);
    return lists.flat().length;
  });
}

/** How many sessions, players and presence rows are left in the whole database. */
async function countAllSessionRows(t: TestConvex) {
  return await t.run(async (ctx) => ({
    participants: (await ctx.db.query("gameParticipants").collect()).length,
    presence: (await ctx.db.query("participantPresence").collect()).length,
    sessions: (await ctx.db.query("gameSessions").collect()).length,
  }));
}

/** Run `fn` on each item, one after the other. */
async function forEachInOrder<T>(
  items: T[],
  fn: (item: T) => Promise<unknown>
) {
  await items.reduce(async (previous, item) => {
    await previous;
    await fn(item);
  }, Promise.resolve());
}

/** Insert `count` lobbies started from `shareToken` straight to the database. */
async function seedLinkLobbies(
  t: TestConvex,
  gameId: Id<"games">,
  shareToken: string,
  count: number
) {
  return await t.run(
    async (ctx) =>
      await Promise.all(
        Array.from({ length: count }, (_, i) =>
          ctx.db.insert("gameSessions", {
            answerRevealed: false,
            currentStepIndex: -1,
            gameId,
            hostTokenHash: "hash",
            inviteCode: `CODE${i}`,
            shareGeneration: 0,
            shareToken,
            status: "waiting",
          })
        )
      )
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("share settings", () => {
  test("sharing is off for a new game, and no link works", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const gameId = await owner.as.mutation(api.games.create, {
      title: "Fresh",
    });

    const view = await owner.as.query(api.games.getEditorView, { gameId });
    expect(view).toMatchObject({ shareEnabled: false, shareToken: null });
    const game = await t.run(async (ctx) => await ctx.db.get(gameId));
    expect(game?.shareEnabled).toBeUndefined();
    expect(game?.shareToken).toBeUndefined();
  });

  test("turning it on creates a link; off and on again restores the same link", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);

    expect(shareToken).toMatch(SHARE_TOKEN);
    expect(await t.query(api.sharing.getSharedGame, { shareToken })).toEqual({
      description: "Learn the basics",
      quizCount: 1,
      stepCount: 3,
      title: "Intro to TypeScript",
    });

    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: false,
      gameId,
    });
    expect(
      await owner.as.query(api.games.getEditorView, { gameId })
    ).toMatchObject({ shareEnabled: false, shareToken: null });
    expect(await t.query(api.sharing.getSharedGame, { shareToken })).toBeNull();

    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: true,
      gameId,
    });
    expect(await currentShareToken(owner.as, gameId)).toBe(shareToken);
    expect(
      await t.query(api.sharing.getSharedGame, { shareToken })
    ).not.toBeNull();
  });

  test("resetting replaces the link", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);

    await owner.as.mutation(api.sharing.resetShareLink, { gameId });

    const newToken = await currentShareToken(owner.as, gameId);
    expect(newToken).not.toBe(shareToken);
    expect(await t.query(api.sharing.getSharedGame, { shareToken })).toBeNull();
    expect(
      await t.query(api.sharing.getSharedGame, { shareToken: newToken })
    ).not.toBeNull();
  });

  test("only the owner can change sharing", async () => {
    const t = newTest();
    const { gameId } = await seedSharedGame(t);
    const mallory = await signUp(t, "mallory@x.test");

    await expect(
      t.mutation(api.sharing.setShareEnabled, { enabled: false, gameId })
    ).rejects.toThrow("Unauthorized");
    await expect(
      mallory.as.mutation(api.sharing.setShareEnabled, {
        enabled: false,
        gameId,
      })
    ).rejects.toThrow("Not found");
    await expect(
      mallory.as.mutation(api.sharing.resetShareLink, { gameId })
    ).rejects.toThrow("Not found");
    // Someone else's editor view doesn't reveal the link either.
    expect(
      await mallory.as.query(api.games.getEditorView, { gameId })
    ).toBeNull();
  });

  test("unknown and malformed tokens find nothing", async () => {
    const t = newTest();
    await seedSharedGame(t);

    await Promise.all(
      ["", "0".repeat(32), "x", "a".repeat(5000)].map(async (shareToken) => {
        expect(
          await t.query(api.sharing.getSharedGame, { shareToken })
        ).toBeNull();
        await expect(
          t.mutation(api.sharing.hostSharedGame, { shareToken })
        ).rejects.toThrow("Link not found");
      })
    );
  });
});

describe("hosting from a share link", () => {
  test("a guest hosts a whole game with the host token", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);

    const { hostToken, sessionId } = await t.mutation(
      api.sharing.hostSharedGame,
      { shareToken }
    );
    expect(hostToken).toMatch(HEX_32_BYTES);
    if (hostToken === null) {
      throw new Error("expected a host token");
    }

    // Only a hash of the host token is stored.
    const stored = await getSession(t, sessionId);
    expect(stored).toMatchObject({ shareToken, status: "waiting" });
    expect(stored?.hostId).toBeUndefined();
    expect(stored?.hostTokenHash).toMatch(HEX_32_BYTES);
    expect(stored?.hostTokenHash).not.toBe(hostToken);

    const ada = await joinAs(t, sessionId, "Ada");
    await joinAs(t, sessionId, "Bob");

    const host = { hostToken, sessionId };
    expect(await t.query(api.sessions.getHostView, host)).toMatchObject({
      gameTitle: "Intro to TypeScript",
      session: { status: "waiting" },
      stepCount: 3,
    });
    expect(
      (await t.query(api.sessions.listHostParticipants, host)).map(
        (p) => p.name
      )
    ).toEqual(["Ada", "Bob"]);

    // Theory, code, then the quiz after its reading phase.
    await t.mutation(api.sessions.advance, host);
    await t.mutation(api.sessions.advance, host);
    await t.mutation(api.sessions.advance, host);
    expect(await t.query(api.sessions.getHostView, host)).toMatchObject({
      currentStep: { question: "Type of 1?" },
      session: { currentStepIndex: 2, status: "in_progress" },
    });
    await expect(
      t.mutation(api.sessions.submitAnswer, {
        choiceIndex: 1,
        participantToken: ada,
        sessionId,
      })
    ).rejects.toThrow("Reading phase still active");
    await finishReadingPhase(t, sessionId);
    await t.mutation(api.sessions.submitAnswer, {
      choiceIndex: 1,
      participantToken: ada,
      sessionId,
    });
    expect(await t.query(api.sessions.getAnswerCount, host)).toEqual({
      answered: 1,
      total: 2,
    });
    await t.mutation(api.sessions.reveal, host);
    await t.mutation(api.sessions.advance, host);

    expect((await getSession(t, sessionId))?.status).toBe("finished");
    const results = await t.query(api.sessions.getResultsView, host);
    expect(results).toMatchObject({
      gameId,
      shareToken,
      stepCount: 3,
    });
    expect(results?.participants.map((p) => p.name)).toEqual(["Ada", "Bob"]);

    // The guest's session isn't the owner's: not listed for them, and they
    // can't open it.
    expect(await owner.as.query(api.sessions.listForGame, { gameId })).toEqual(
      []
    );
    expect(
      await owner.as.query(api.sessions.getHostView, { sessionId })
    ).toBeNull();
  });

  test("the host screen and controls need the right host token", async () => {
    const t = newTest();
    const { shareToken } = await seedSharedGame(t);
    const { sessionId } = await t.mutation(api.sharing.hostSharedGame, {
      shareToken,
    });
    await joinAs(t, sessionId, "Ada");
    const mallory = await signUp(t, "mallory@x.test");

    await Promise.all(
      [undefined, "f".repeat(64), shareToken].map(async (hostToken) => {
        const args = { hostToken, sessionId };
        expect(await t.query(api.sessions.getHostView, args)).toBeNull();
        expect(
          await mallory.as.query(api.sessions.getHostView, args)
        ).toBeNull();
        expect(await t.query(api.sessions.listHostParticipants, args)).toEqual(
          []
        );
        expect(await t.query(api.sessions.getAnswerCount, args)).toBeNull();
        expect(await t.query(api.sessions.getResultsView, args)).toBeNull();
        await expect(t.mutation(api.sessions.advance, args)).rejects.toThrow(
          "Not found"
        );
        await expect(t.mutation(api.sessions.reveal, args)).rejects.toThrow(
          "Not found"
        );
      })
    );
    expect((await getSession(t, sessionId))?.status).toBe("waiting");
  });

  test("a signed-in user who isn't the owner also gets a host token", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);
    const bea = await signUp(t, "bea@x.test");

    const { hostToken, sessionId } = await bea.as.mutation(
      api.sharing.hostSharedGame,
      { shareToken }
    );
    expect(hostToken).not.toBeNull();
    expect((await getSession(t, sessionId))?.hostId).toBeUndefined();
    // Their account alone doesn't make them the host.
    expect(
      await bea.as.query(api.sessions.getHostView, { sessionId })
    ).toBeNull();
    expect(
      await bea.as.query(api.sessions.getHostView, {
        hostToken: hostToken ?? undefined,
        sessionId,
      })
    ).not.toBeNull();
    expect(await owner.as.query(api.sessions.listForGame, { gameId })).toEqual(
      []
    );
  });

  test("the signed-in owner gets an ordinary session", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);

    const { hostToken, sessionId } = await owner.as.mutation(
      api.sharing.hostSharedGame,
      { shareToken }
    );

    expect(hostToken).toBeNull();
    const stored = await getSession(t, sessionId);
    expect(stored?.hostId).toBe(owner.userId);
    expect(stored?.shareToken).toBeUndefined();
    expect(
      (await owner.as.query(api.sessions.listForGame, { gameId })).map(
        (s) => s._id
      )
    ).toEqual([sessionId]);
    expect(
      await owner.as.query(api.sessions.getResultsView, { sessionId })
    ).toMatchObject({ shareToken: null });
  });

  test("a link that is off can't start a session", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);
    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: false,
      gameId,
    });

    await expect(
      t.mutation(api.sharing.hostSharedGame, { shareToken })
    ).rejects.toThrow("Link not found");
  });

  test("starting sessions from a link is rate-limited", async () => {
    const t = newTest();
    const { shareToken } = await seedSharedGame(t);

    await repeat(30, () =>
      t.mutation(api.sharing.hostSharedGame, { shareToken })
    );
    await expect(
      t.mutation(api.sharing.hostSharedGame, { shareToken })
    ).rejects.toThrow("Rate limit exceeded");

    vi.advanceTimersByTime(61_000);
    await t.mutation(api.sharing.hostSharedGame, { shareToken });
  });

  test("a finished session can't be advanced again", async () => {
    const t = newTest();
    const { shareToken } = await seedSharedGame(t);
    const { hostToken, sessionId } = await t.mutation(
      api.sharing.hostSharedGame,
      { shareToken }
    );
    const host = { hostToken: hostToken ?? undefined, sessionId };
    await joinAs(t, sessionId, "Ada");
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, { status: "finished" });
    });

    await expect(t.mutation(api.sessions.advance, host)).rejects.toThrow(
      "Session has ended"
    );
    expect(await t.mutation(api.sessions.reveal, host)).toBeNull();
    expect((await getSession(t, sessionId))?.status).toBe("finished");
  });

  test("results only show the session's own answers", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);

    // The owner plays the game with Ada, who answers the quiz.
    const ownSessionId = await owner.as.mutation(api.sessions.create, {
      gameId,
    });
    const ada = await joinAs(t, ownSessionId, "Ada");
    await repeat(3, () =>
      owner.as.mutation(api.sessions.advance, { sessionId: ownSessionId })
    );
    await finishReadingPhase(t, ownSessionId);
    await t.mutation(api.sessions.submitAnswer, {
      choiceIndex: 1,
      participantToken: ada,
      sessionId: ownSessionId,
    });
    // And an answer from before answers had a session id, whose player is
    // gone.
    const quizId = await getQuizStepId(t, gameId);
    await t.run(async (ctx) => {
      const participantId = await ctx.db.insert("gameParticipants", {
        name: "Old",
        participantToken: "old",
        sessionId: ownSessionId,
        totalScore: 0,
      });
      await ctx.db.delete(participantId);
      await ctx.db.insert("participantAnswers", {
        choiceIndex: 0,
        isCorrect: false,
        participantId,
        score: 0,
        stepId: quizId,
      });
    });

    // A guest's session that nobody joined has no results.
    const guest = await t.mutation(api.sharing.hostSharedGame, {
      shareToken,
    });
    const host = {
      hostToken: guest.hostToken ?? undefined,
      sessionId: guest.sessionId,
    };
    await repeat(4, () => t.mutation(api.sessions.advance, host));
    expect(await t.query(api.sessions.getResultsView, host)).toMatchObject({
      answers: [],
      participants: [],
    });

    // An empty session of the owner's still shows the old answer, but not
    // Ada's, which belongs to another session.
    const emptySessionId = await owner.as.mutation(api.sessions.create, {
      gameId,
    });
    const emptyResults = await owner.as.query(api.sessions.getResultsView, {
      sessionId: emptySessionId,
    });
    expect(emptyResults?.answers).toEqual([
      expect.objectContaining({ choiceIndex: 0, isCorrect: false }),
    ]);
    expect(emptyResults?.participants.map((p) => p.name)).toEqual([
      "Archived participant 1",
    ]);
  });
});

describe("turning a link off or resetting it", () => {
  /** A guest-hosted session in the lobby and another in progress, plus an owner's session. */
  async function seedRunningSessions(t: TestConvex) {
    const shared = await seedSharedGame(t);
    const lobby = await t.mutation(api.sharing.hostSharedGame, {
      shareToken: shared.shareToken,
    });
    const running = await t.mutation(api.sharing.hostSharedGame, {
      shareToken: shared.shareToken,
    });
    const player = await joinAs(t, running.sessionId, "Ada");
    await t.mutation(api.sessions.advance, {
      hostToken: running.hostToken ?? undefined,
      sessionId: running.sessionId,
    });
    const ownSessionId = await shared.owner.as.mutation(api.sessions.create, {
      gameId: shared.gameId,
    });
    return { ...shared, lobby, ownSessionId, player, running };
  }

  test("turning it off ends the link's sessions and locks out their hosts", async () => {
    const t = newTest();
    const { gameId, lobby, owner, ownSessionId, player, running } =
      await seedRunningSessions(t);

    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: false,
      gameId,
    });

    // Hosts lose access at once, before their sessions are ended.
    const host = {
      hostToken: running.hostToken ?? undefined,
      sessionId: running.sessionId,
    };
    expect(await t.query(api.sessions.getHostView, host)).toBeNull();
    await expect(t.mutation(api.sessions.advance, host)).rejects.toThrow(
      "Not found"
    );

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect((await getSession(t, lobby.sessionId))?.status).toBe("finished");
    expect((await getSession(t, running.sessionId))?.status).toBe("finished");
    expect(
      await t.query(api.sessions.getPlayerState, {
        participantToken: player,
        sessionId: running.sessionId,
      })
    ).toMatchObject({ session: { status: "finished" } });
    // Their results went with the link.
    expect(await t.query(api.sessions.getResultsView, host)).toBeNull();
    // The owner's own session is untouched.
    expect((await getSession(t, ownSessionId))?.status).toBe("waiting");
  });

  test("sessions started after the link is turned back on keep running, even in the same millisecond", async () => {
    const t = newTest();
    const { gameId, owner, running, shareToken } = await seedRunningSessions(t);

    // The clock is frozen: everything below happens at the same time.
    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: false,
      gameId,
    });
    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: true,
      gameId,
    });
    // Same link, but the earlier session's host doesn't get it back, even
    // before that session is ended in the background.
    expect(
      await t.query(api.sessions.getHostView, {
        hostToken: running.hostToken ?? undefined,
        sessionId: running.sessionId,
      })
    ).toBeNull();
    const later = await t.mutation(api.sharing.hostSharedGame, { shareToken });
    const laterLobby = await t.mutation(api.sharing.hostSharedGame, {
      shareToken,
    });
    const laterHost = {
      hostToken: later.hostToken ?? undefined,
      sessionId: later.sessionId,
    };
    await joinAs(t, later.sessionId, "Ada");
    await t.mutation(api.sessions.advance, laterHost);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect((await getSession(t, running.sessionId))?.status).toBe("finished");
    expect((await getSession(t, later.sessionId))?.status).toBe("in_progress");
    expect((await getSession(t, laterLobby.sessionId))?.status).toBe("waiting");
    expect(await t.query(api.sessions.getHostView, laterHost)).not.toBeNull();
    await joinAs(t, laterLobby.sessionId, "Bob");
  });

  test("resetting ends the old link's sessions; the new link works", async () => {
    const t = newTest();
    const { gameId, lobby, owner, ownSessionId } = await seedRunningSessions(t);

    await owner.as.mutation(api.sharing.resetShareLink, { gameId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect((await getSession(t, lobby.sessionId))?.status).toBe("finished");
    expect(
      await t.query(api.sessions.getHostView, {
        hostToken: lobby.hostToken ?? undefined,
        sessionId: lobby.sessionId,
      })
    ).toBeNull();
    expect((await getSession(t, ownSessionId))?.status).toBe("waiting");

    const newToken = await currentShareToken(owner.as, gameId);
    const fresh = await t.mutation(api.sharing.hostSharedGame, {
      shareToken: newToken,
    });
    expect(
      await t.query(api.sessions.getHostView, {
        hostToken: fresh.hostToken ?? undefined,
        sessionId: fresh.sessionId,
      })
    ).not.toBeNull();
  });

  test("players can't join a session whose link was turned off or reset", async () => {
    const t = newTest();
    const { gameId, lobby, owner, shareToken } = await seedRunningSessions(t);

    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: false,
      gameId,
    });
    // Not even before the session is ended in the background
    await expect(joinAs(t, lobby.sessionId, "Early")).rejects.toThrow(
      "Session has ended"
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(joinAs(t, lobby.sessionId, "Late")).rejects.toThrow(
      "Session has ended"
    );

    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: true,
      gameId,
    });
    const next = await t.mutation(api.sharing.hostSharedGame, { shareToken });
    await owner.as.mutation(api.sharing.resetShareLink, { gameId });
    await expect(joinAs(t, next.sessionId, "Early")).rejects.toThrow(
      "Session has ended"
    );
  });

  test("many sessions are ended in batches", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);
    const sessionIds = await seedLinkLobbies(t, gameId, shareToken, 250);

    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: false,
      gameId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const statuses = await t.run(
      async (ctx) =>
        await Promise.all(
          sessionIds.map(async (id) => (await ctx.db.get(id))?.status)
        )
    );
    expect(new Set(statuses)).toEqual(new Set(["finished"]));
  });
});

describe("previewing shared steps", () => {
  test("visitors can read every step in play order, including code and quiz answers", async () => {
    const t = newTest();
    const { shareToken } = await seedSharedGame(t);
    const first = await t.query(api.sharing.getSharedGameSteps, {
      paginationOpts: { cursor: null, numItems: 2 },
      shareToken,
    });

    expect(first.isDone).toBe(false);
    expect(first.page).toEqual([
      {
        _id: expect.any(String),
        image: null,
        markdownContent: "# Types",
        type: "theory",
      },
      {
        _id: expect.any(String),
        codeBlock: {
          annotations: [
            { explanation: "A number", label: "n", lines: [1], linesText: "1" },
          ],
          code: "const n = 1;",
          language: "typescript",
        },
        image: null,
        markdownContent: "Code",
        type: "theory",
      },
    ]);

    const last = await t.query(api.sharing.getSharedGameSteps, {
      paginationOpts: { cursor: first.continueCursor, numItems: 2 },
      shareToken,
    });
    expect(last.isDone).toBe(true);
    expect(last.page).toEqual([
      {
        _id: expect.any(String),
        choices: [
          { isCorrect: false, text: "string" },
          { isCorrect: true, text: "number" },
        ],
        image: null,
        question: "Type of 1?",
        timeLimitSeconds: 20,
        type: "quiz",
      },
    ]);
  });

  test("theory and quiz previews include viewable images without upload metadata", async () => {
    const t = newTest();
    const { gameId, shareToken } = await seedSharedGame(t);
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(["encrypted image"]));
      const steps = await ctx.db
        .query("gameSteps")
        .withIndex("by_game_and_order", (q) => q.eq("gameId", gameId))
        .collect();
      await Promise.all(
        [steps[0], steps[2]].map((step) =>
          ctx.db.patch(step._id, {
            image: {
              alt: "Type diagram",
              height: 100,
              key: "image-key",
              storageId: id,
              type: "image/png",
              width: 200,
            },
            imageUploads: 1,
          })
        )
      );
      return id;
    });
    const preview = await t.query(api.sharing.getSharedGameSteps, {
      paginationOpts: { cursor: null, numItems: 10 },
      shareToken,
    });
    const expected = {
      alt: "Type diagram",
      height: 100,
      key: "image-key",
      type: "image/png",
      url: expect.any(String),
      width: 200,
    };
    expect(preview.page[0].image).toEqual(expected);
    expect(preview.page[1].image).toBeNull();
    expect(preview.page[2].image).toEqual(expected);
    expect(preview.page[0]).not.toHaveProperty("imageUploads");
    const bea = await signUp(t, "image-preview@x.test");
    await expect(
      bea.as.mutation(api.steps.removeImage, {
        stepId: preview.page[0]._id,
        storageId,
      })
    ).rejects.toThrow();
    await expect(
      bea.as.mutation(api.steps.setImageAlt, {
        alt: "Changed",
        stepId: preview.page[0]._id,
        storageId,
      })
    ).rejects.toThrow();
  });

  test("a share link grants no editing rights to visitors or other accounts", async () => {
    const t = newTest();
    const { gameId, shareToken } = await seedSharedGame(t);
    const bea = await signUp(t, "preview@x.test");
    const args = { paginationOpts: { cursor: null, numItems: 10 }, shareToken };
    const anonymous = await t.query(api.sharing.getSharedGameSteps, args);
    const signedIn = await bea.as.query(api.sharing.getSharedGameSteps, args);
    expect(signedIn.page).toEqual(anonymous.page);
    const theoryId = anonymous.page[0]._id;
    const quizId = anonymous.page[2]._id;

    await Promise.all(
      [t, bea.as].map(async (visitor) => {
        expect(
          await visitor.query(api.games.getEditorView, { gameId })
        ).toBeNull();
        expect(
          await visitor.query(api.steps.get, { stepId: theoryId })
        ).toBeNull();
        await expect(
          visitor.mutation(api.steps.updateTheory, {
            markdownContent: "Changed",
            stepId: theoryId,
          })
        ).rejects.toThrow();
        await expect(
          visitor.mutation(api.steps.updateQuiz, {
            question: "Changed",
            stepId: quizId,
          })
        ).rejects.toThrow();
        await expect(
          visitor.mutation(api.steps.remove, { stepId: theoryId })
        ).rejects.toThrow();
        await expect(
          visitor.mutation(api.steps.move, {
            direction: "down",
            stepId: theoryId,
          })
        ).rejects.toThrow();
        await expect(
          visitor.mutation(api.steps.createTheory, { gameId })
        ).rejects.toThrow();
        await expect(
          visitor.mutation(api.steps.reorder, {
            gameId,
            orderedIds: anonymous.page.map((step) => step._id),
          })
        ).rejects.toThrow();
      })
    );
    expect((await t.query(api.sharing.getSharedGameSteps, args)).page).toEqual(
      anonymous.page
    );
  });

  test("disabled, reset, and deleted links stop returning steps, even with an existing cursor", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);
    const first = await t.query(api.sharing.getSharedGameSteps, {
      paginationOpts: { cursor: null, numItems: 1 },
      shareToken,
    });
    const next = {
      paginationOpts: { cursor: first.continueCursor, numItems: 1 },
      shareToken,
    };
    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: false,
      gameId,
    });
    expect((await t.query(api.sharing.getSharedGameSteps, next)).page).toEqual(
      []
    );

    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: true,
      gameId,
    });
    await owner.as.mutation(api.sharing.resetShareLink, { gameId });
    expect((await t.query(api.sharing.getSharedGameSteps, next)).page).toEqual(
      []
    );
    const newToken = await currentShareToken(owner.as, gameId);
    expect(
      (
        await t.query(api.sharing.getSharedGameSteps, {
          paginationOpts: { cursor: null, numItems: 10 },
          shareToken: newToken,
        })
      ).page
    ).toHaveLength(3);

    await owner.as.mutation(api.games.remove, { gameId });
    expect(
      (
        await t.query(api.sharing.getSharedGameSteps, {
          paginationOpts: { cursor: null, numItems: 10 },
          shareToken: newToken,
        })
      ).page
    ).toEqual([]);
  });

  test("invalid tokens and empty games have no steps", async () => {
    const t = newTest();
    await Promise.all(
      ["", "x", "0".repeat(32), "a".repeat(5000)].map(async (shareToken) => {
        expect(
          await t.query(api.sharing.getSharedGameSteps, {
            paginationOpts: { cursor: null, numItems: 10 },
            shareToken,
          })
        ).toMatchObject({ isDone: true, page: [] });
      })
    );
    const owner = await signUp(t, "empty@x.test");
    const gameId = await owner.as.mutation(api.games.create, {
      title: "Empty",
    });
    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: true,
      gameId,
    });
    expect(
      await t.query(api.sharing.getSharedGameSteps, {
        paginationOpts: { cursor: null, numItems: 10 },
        shareToken: await currentShareToken(owner.as, gameId),
      })
    ).toMatchObject({ isDone: true, page: [] });
  });
});

describe("copying a shared game", () => {
  test("a signed-in user gets their own private copy with every step", async () => {
    const t = newTest();
    const { gameId, shareToken } = await seedSharedGame(t);
    const bea = await signUp(t, "bea@x.test");

    const copyId = await bea.as.mutation(api.sharing.copySharedGame, {
      shareToken,
    });

    expect(copyId).not.toBe(gameId);
    const copy = await t.run(async (ctx) => await ctx.db.get(copyId));
    expect(copy).toMatchObject({
      createdById: bea.userId,
      description: "Learn the basics",
      title: "Intro to TypeScript",
    });
    expect(copy?.shareEnabled).toBeUndefined();
    expect(copy?.shareToken).toBeUndefined();

    const stepsOf = async (id: Id<"games">) =>
      await t.run(async (ctx) =>
        (
          await ctx.db
            .query("gameSteps")
            .withIndex("by_game_and_order", (q) => q.eq("gameId", id))
            .collect()
        ).map(({ _creationTime, _id, gameId: _gameId, ...step }) => step)
      );
    const copiedSteps = await stepsOf(copyId);
    expect(copiedSteps).toEqual(await stepsOf(gameId));
    expect(copiedSteps.map((step) => step.order)).toEqual([0, 1, 2]);

    // It shows up in their games, and they can edit it like their own.
    expect(
      (await bea.as.query(api.games.list, {})).map((game) => game._id)
    ).toEqual([copyId]);
    const editorView = await bea.as.query(api.games.getEditorView, {
      gameId: copyId,
    });
    expect(editorView).toMatchObject({ shareEnabled: false, shareToken: null });
    const firstStep = editorView?.steps[0]?._id;
    if (!firstStep) {
      throw new Error("no steps");
    }
    await bea.as.mutation(api.steps.updateTheory, {
      markdownContent: "# Changed",
      stepId: firstStep,
    });
    // Editing the copy leaves the original as it was.
    expect((await stepsOf(gameId))[0]).toMatchObject({
      markdownContent: "# Types",
    });
  });

  test("the owner can copy their own game", async () => {
    const t = newTest();
    const { owner, shareToken } = await seedSharedGame(t);

    await owner.as.mutation(api.sharing.copySharedGame, { shareToken });

    expect(await owner.as.query(api.games.list, {})).toHaveLength(2);
  });

  test("copying needs an account and a link that works", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);
    const bea = await signUp(t, "bea@x.test");

    await expect(
      t.mutation(api.sharing.copySharedGame, { shareToken })
    ).rejects.toThrow("Unauthorized");

    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: false,
      gameId,
    });
    await expect(
      bea.as.mutation(api.sharing.copySharedGame, { shareToken })
    ).rejects.toThrow("Link not found");
    expect(await bea.as.query(api.games.list, {})).toEqual([]);
  });

  test("copying is rate-limited per user", async () => {
    const t = newTest();
    const { shareToken } = await seedSharedGame(t);
    const bea = await signUp(t, "bea@x.test");

    await repeat(10, () =>
      bea.as.mutation(api.sharing.copySharedGame, { shareToken })
    );
    await expect(
      bea.as.mutation(api.sharing.copySharedGame, { shareToken })
    ).rejects.toThrow("Rate limit exceeded");
  });
});

describe("abandoned share link lobbies", () => {
  test("lobbies never started are deleted after a day, with their players", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);
    const abandoned = await t.mutation(api.sharing.hostSharedGame, {
      shareToken,
    });
    await joinAs(t, abandoned.sessionId, "Ada");
    const started = await t.mutation(api.sharing.hostSharedGame, {
      shareToken,
    });
    await joinAs(t, started.sessionId, "Bob");
    await t.mutation(api.sessions.advance, {
      hostToken: started.hostToken ?? undefined,
      sessionId: started.sessionId,
    });
    const ownLobby = await owner.as.mutation(api.sessions.create, { gameId });

    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    const recent = await t.mutation(api.sharing.hostSharedGame, {
      shareToken,
    });
    vi.advanceTimersByTime(13 * 60 * 60 * 1000);

    expect(
      await t.mutation(internal.sharing.cleanupAbandonedLinkSessions, {})
    ).toEqual({ deleted: 1 });
    // Its players are deleted in the background
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await getSession(t, abandoned.sessionId)).toBeNull();
    expect(await getSession(t, started.sessionId)).not.toBeNull();
    expect(await getSession(t, recent.sessionId)).not.toBeNull();
    expect(await getSession(t, ownLobby)).not.toBeNull();
    const [participants, presence] = await t.run(
      async (ctx) =>
        await Promise.all([
          ctx.db.query("gameParticipants").collect(),
          ctx.db.query("participantPresence").collect(),
        ])
    );
    expect(participants.map((p) => p.name)).toEqual(["Bob"]);
    expect(presence.some((row) => row.sessionId === abandoned.sessionId)).toBe(
      false
    );
  });

  test("lobbies with many players are deleted over several runs, within transaction limits", async () => {
    const t = newTest();
    const { gameId, shareToken } = await seedSharedGame(t);
    // 50 lobbies of 161 players: over 16,000 rows, more than one
    // transaction may write.
    const sessionIds = await seedLinkLobbies(t, gameId, shareToken, 50);
    await forEachInOrder(sessionIds, (sessionId) =>
      seedPlayers(t, sessionId, 161)
    );
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);

    // One run deletes the lobbies; their players follow in the background.
    expect(
      await t.mutation(internal.sharing.cleanupAbandonedLinkSessions, {})
    ).toEqual({ deleted: 50 });
    expect(await countAllSessionRows(t)).toEqual({
      participants: 50 * 161,
      presence: 50 * 161,
      sessions: 0,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await countAllSessionRows(t)).toEqual({
      participants: 0,
      presence: 0,
      sessions: 0,
    });
  });

  test("a lobby being deleted can't be started or joined any more", async () => {
    const t = newTest();
    const { shareToken } = await seedSharedGame(t);
    const { hostToken, sessionId } = await t.mutation(
      api.sharing.hostSharedGame,
      { shareToken }
    );
    const { inviteCode } = (await getSession(t, sessionId)) ?? {};
    await seedPlayers(t, sessionId, 200);
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);

    await t.mutation(internal.sharing.cleanupAbandonedLinkSessions, {});

    // Its players are still being deleted, but the lobby is already gone.
    expect(await countSessionRows(t, sessionId)).toBe(400);
    await expect(
      t.mutation(api.sessions.advance, {
        hostToken: hostToken ?? undefined,
        sessionId,
      })
    ).rejects.toThrow("Not found");
    await expect(
      t.mutation(api.sessions.joinByCode, {
        inviteCode: inviteCode ?? "",
        name: "Late",
      })
    ).rejects.toThrow("Invalid invite code");

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await countSessionRows(t, sessionId)).toBe(0);
  });

  test("players saved with huge emails are deleted within transaction limits", async () => {
    const t = newTest();
    const { shareToken } = await seedSharedGame(t);
    const { sessionId } = await t.mutation(api.sharing.hostSharedGame, {
      shareToken,
    });
    // Before emails were limited, a player could be saved with a ~1 MB
    // one: 20 of them are more than a transaction may read.
    await repeat(5, () =>
      t.run(async (ctx) => {
        await Promise.all(
          Array.from({ length: 4 }, (_, i) =>
            ctx.db.insert("gameParticipants", {
              email: "x".repeat(900_000),
              name: `Big ${i}`,
              participantToken: crypto.randomUUID(),
              sessionId,
              totalScore: 0,
            })
          )
        );
      })
    );

    // One run reads a few of them, by size.
    await t.mutation(internal.sessions.deleteSessionChildren, { sessionId });
    const left = await countSessionRows(t, sessionId);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(20);

    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    await t.mutation(internal.sharing.cleanupAbandonedLinkSessions, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await countSessionRows(t, sessionId)).toBe(0);
    expect(await getSession(t, sessionId)).toBeNull();
  });
});

describe("a game played many times from its link", () => {
  // Seeds 33,000 answers, which takes a few seconds on a busy CI runner.
  test("its sessions only read their own answers", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);
    const quizId = await getQuizStepId(t, gameId);
    // 33,000 answers from guests' sessions: more than a transaction may read
    const guest = await t.mutation(api.sharing.hostSharedGame, {
      shareToken,
    });
    const guestPlayer = await t.run(
      async (ctx) =>
        await ctx.db.insert("gameParticipants", {
          name: "Guest player",
          participantToken: "guest-player",
          sessionId: guest.sessionId,
          totalScore: 0,
        })
    );
    await repeat(3, () =>
      t.run(async (ctx) => {
        await Promise.all(
          Array.from({ length: 11_000 }, () =>
            ctx.db.insert("participantAnswers", {
              choiceIndex: 1,
              isCorrect: true,
              participantId: guestPlayer,
              score: 1000,
              sessionId: guest.sessionId,
              stepId: quizId,
            })
          )
        );
      })
    );

    // The owner's game still runs: answering, counting answers, results.
    const sessionId = await owner.as.mutation(api.sessions.create, { gameId });
    const ada = await joinAs(t, sessionId, "Ada");
    await joinAs(t, sessionId, "Bob");
    await repeat(3, () =>
      owner.as.mutation(api.sessions.advance, { sessionId })
    );
    await finishReadingPhase(t, sessionId);
    await t.mutation(api.sessions.submitAnswer, {
      choiceIndex: 1,
      participantToken: ada,
      sessionId,
    });
    expect(
      await owner.as.query(api.sessions.getAnswerCount, { sessionId })
    ).toEqual({ answered: 1, total: 2 });
    expect(
      (await owner.as.query(api.sessions.getResultsView, { sessionId }))
        ?.answers
    ).toHaveLength(1);
    const emptySessionId = await owner.as.mutation(api.sessions.create, {
      gameId,
    });
    expect(
      await owner.as.query(api.sessions.getResultsView, {
        sessionId: emptySessionId,
      })
    ).toMatchObject({ answers: [] });

    // Removing the quiz deletes its answers in the background; results
    // leave them out at once.
    await owner.as.mutation(api.steps.remove, { stepId: quizId });
    expect(
      (await owner.as.query(api.sessions.getResultsView, { sessionId }))
        ?.answers
    ).toEqual([]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await t.run(
        async (ctx) =>
          (await ctx.db.query("participantAnswers").collect()).length
      )
    ).toBe(0);
  }, 30_000);

  test("a player's email can't be longer than an email address", async () => {
    const t = newTest();
    const { shareToken } = await seedSharedGame(t);
    const { sessionId } = await t.mutation(api.sharing.hostSharedGame, {
      shareToken,
    });

    await expect(
      t.mutation(api.sessions.join, {
        email: `${"x".repeat(250)}@x.test`,
        name: "Ada",
        sessionId,
      })
    ).rejects.toThrow("Invalid email");
    await t.mutation(api.sessions.join, {
      email: "ada@x.test",
      name: "Ada",
      sessionId,
    });
  });
});

describe("deleting a shared game", () => {
  test("stops its link and sessions at once, and deletes them in the background", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);
    const { hostToken, sessionId } = await t.mutation(
      api.sharing.hostSharedGame,
      { shareToken }
    );
    const player = await joinAs(t, sessionId, "Ada");
    const { inviteCode } = (await getSession(t, sessionId)) ?? {};
    const ownSessionId = await owner.as.mutation(api.sessions.create, {
      gameId,
    });

    await owner.as.mutation(api.games.remove, { gameId });

    expect(await t.query(api.sharing.getSharedGame, { shareToken })).toBeNull();
    expect(
      await t.query(api.sessions.getHostView, {
        hostToken: hostToken ?? undefined,
        sessionId,
      })
    ).toBeNull();
    expect(
      await t.query(api.sessions.getPlayerState, {
        participantToken: player,
        sessionId,
      })
    ).toBeNull();
    expect(
      await t.query(api.sessions.getByInviteCode, { code: inviteCode ?? "" })
    ).toBeNull();
    await expect(joinAs(t, sessionId, "Bob")).rejects.toThrow(
      "Session has ended"
    );
    // The owner's own sessions too
    const own = { sessionId: ownSessionId };
    expect(await owner.as.query(api.sessions.getHostView, own)).toBeNull();
    expect(await owner.as.query(api.sessions.getResultsView, own)).toBeNull();
    // Invite emails check the session with getForHost
    expect(await owner.as.query(api.sessions.getForHost, own)).toBeNull();
    await expect(owner.as.mutation(api.sessions.advance, own)).rejects.toThrow(
      "Not found"
    );
    await expect(joinAs(t, ownSessionId, "Bob")).rejects.toThrow(
      "Session has ended"
    );

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await getSession(t, sessionId)).toBeNull();
    expect(await getSession(t, ownSessionId)).toBeNull();
    expect(await countSessionRows(t, sessionId)).toBe(0);
  });

  test("a game with many sessions and players is deleted in bounded batches, within transaction limits", async () => {
    const t = newTest();
    const { gameId, owner, shareToken } = await seedSharedGame(t);
    // 70 minutes of lobbies at the link's rate limit, and a crowded one
    const sessionIds = await seedLinkLobbies(t, gameId, shareToken, 2100);
    await seedPlayers(t, sessionIds[0], 450);

    await owner.as.mutation(api.games.remove, { gameId });
    const countSessions = async () =>
      await t.run(
        async (ctx) =>
          (
            await ctx.db
              .query("gameSessions")
              .withIndex("by_game", (q) => q.eq("gameId", gameId))
              .collect()
          ).length
      );
    expect(await countSessions()).toBe(2100);

    // One run deletes 100 sessions; their players follow in the background.
    await t.mutation(internal.games.deleteGameData, { gameId });
    expect(await countSessions()).toBe(2000);
    expect(await countSessionRows(t, sessionIds[0])).toBe(900);

    await t.finishAllScheduledFunctions(vi.runAllTimers, 1000);
    expect(await countAllSessionRows(t)).toEqual({
      participants: 0,
      presence: 0,
      sessions: 0,
    });
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("gameSteps").collect()).length
      )
    ).toBe(0);
  });
});
