/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

/** A fresh in-memory Convex backend for one test. */
function newTest() {
  return convexTest(schema, modules);
}

type TestConvex = ReturnType<typeof newTest>;

const USER_DATA_TABLES = [
  "users",
  "authAccounts",
  "authVerificationCodes",
  "games",
  "gameSteps",
  "gameSessions",
  "gameParticipants",
  "participantAnswers",
  "emailLists",
  "emailListEntries",
] as const;

/** Row counts for one user seeded by `seedUser`. */
const ONE_USER = {
  authAccounts: 1,
  authVerificationCodes: 1,
  emailListEntries: 1,
  emailLists: 1,
  gameParticipants: 2,
  gameSessions: 1,
  gameSteps: 1,
  games: 1,
  participantAnswers: 4,
  users: 1,
};

/** Seed a user with one of everything they can own: a game with a step, a
 * finished session with two participants and their answers (including a
 * legacy answer saved without a sessionId), an email list with an entry, and
 * a password account with an unused sign-in code. */
async function seedUser(t: TestConvex, label: string) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: `${label}@x.test` });
    const accountId = await ctx.db.insert("authAccounts", {
      provider: "password",
      providerAccountId: `${label}@x.test`,
      userId,
    });
    await ctx.db.insert("authVerificationCodes", {
      accountId,
      code: `code-${label}`,
      expirationTime: Date.now() + 60_000,
      provider: "resend",
    });
    const gameId = await ctx.db.insert("games", {
      createdById: userId,
      title: `${label} game`,
      updatedAt: Date.now(),
    });
    const stepId = await ctx.db.insert("gameSteps", {
      choices: [{ isCorrect: true, text: "a" }],
      gameId,
      order: 0,
      question: "q",
      type: "quiz",
    });
    const sessionId = await ctx.db.insert("gameSessions", {
      answerRevealed: false,
      currentStepIndex: 0,
      gameId,
      hostId: userId,
      inviteCode: `INV${label}`,
      status: "finished",
    });
    await Promise.all(
      ["p1", "p2"].map(async (name) => {
        const participantId = await ctx.db.insert("gameParticipants", {
          name,
          participantToken: `${label}-${name}`,
          sessionId,
          totalScore: 0,
        });
        await Promise.all([
          ctx.db.insert("participantAnswers", {
            choiceIndex: 0,
            isCorrect: true,
            participantId,
            score: 100,
            sessionId,
            stepId,
          }),
          ctx.db.insert("participantAnswers", {
            choiceIndex: 0,
            isCorrect: false,
            participantId,
            score: 0,
            stepId,
          }),
        ]);
      })
    );
    const listId = await ctx.db.insert("emailLists", {
      createdById: userId,
      title: `${label} list`,
    });
    await ctx.db.insert("emailListEntries", {
      email: "friend@x.test",
      listId,
      name: "Friend",
    });
    return { gameId, listId, userId };
  });
}

/** Row count of every table that can hold user data. */
async function countRows(t: TestConvex) {
  return await t.run(async (ctx) => {
    const counts = await Promise.all(
      USER_DATA_TABLES.map(
        async (table) =>
          [table, (await ctx.db.query(table).collect()).length] as const
      )
    );
    return Object.fromEntries(counts);
  });
}

/** Signs in as `userId` (@convex-dev/auth reads the user from `subject`). */
function asUser(t: TestConvex, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

describe("account.deleteAllData", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("removes everything the user owns and nothing else", async () => {
    vi.useFakeTimers();
    const t = newTest();
    const alice = await seedUser(t, "alice");
    await seedUser(t, "bob");

    await t.mutation(internal.account.deleteAllData, { userId: alice.userId });
    // Games are deleted by scheduled per-game mutations
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await countRows(t)).toEqual(ONE_USER);
    const remaining = await t.run(async (ctx) => ({
      games: (await ctx.db.query("games").collect()).map((g) => g.title),
      lists: (await ctx.db.query("emailLists").collect()).map((l) => l.title),
      users: (await ctx.db.query("users").collect()).map((u) => u.email),
    }));
    expect(remaining).toEqual({
      games: ["bob game"],
      lists: ["bob list"],
      users: ["bob@x.test"],
    });
  });
});

describe("games.deleteGameData", () => {
  test("is a no-op when the game is already gone", async () => {
    const t = newTest();
    const alice = await seedUser(t, "alice");

    await t.mutation(internal.games.deleteGameData, { gameId: alice.gameId });
    await t.mutation(internal.games.deleteGameData, { gameId: alice.gameId });

    expect(await countRows(t)).toMatchObject({
      games: 0,
      participantAnswers: 0,
    });
  });
});

describe("games.remove", () => {
  test("deletes the game with its steps, sessions, participants and answers", async () => {
    const t = newTest();
    const alice = await seedUser(t, "alice");

    await asUser(t, alice.userId).mutation(api.games.remove, {
      gameId: alice.gameId,
    });

    expect(await countRows(t)).toMatchObject({
      gameParticipants: 0,
      gameSessions: 0,
      gameSteps: 0,
      games: 0,
      participantAnswers: 0,
      users: 1,
    });
  });

  test("refuses to delete another user's game", async () => {
    const t = newTest();
    const alice = await seedUser(t, "alice");
    const bob = await seedUser(t, "bob");

    await expect(
      asUser(t, bob.userId).mutation(api.games.remove, {
        gameId: alice.gameId,
      })
    ).rejects.toThrow("Not found");
    expect((await countRows(t)).games).toBe(2);
  });
});

describe("emailLists.remove", () => {
  test("deletes the list and its entries", async () => {
    const t = newTest();
    const alice = await seedUser(t, "alice");

    await asUser(t, alice.userId).mutation(api.emailLists.remove, {
      listId: alice.listId,
    });

    expect(await countRows(t)).toMatchObject({
      emailListEntries: 0,
      emailLists: 0,
    });
  });
});
