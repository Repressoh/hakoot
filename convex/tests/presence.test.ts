/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

/** A fresh in-memory Convex backend for one test. */
function newTest() {
  return convexTest(schema, modules);
}

type TestConvex = ReturnType<typeof newTest>;

/** A host with a one-step game and a session waiting in the lobby. */
async function seedLobby(t: TestConvex) {
  const { sessionId, userId } = await t.run(async (ctx) => {
    const hostId = await ctx.db.insert("users", { email: "host@x.test" });
    const gameId = await ctx.db.insert("games", {
      createdById: hostId,
      title: "Game",
      updatedAt: 0,
    });
    await ctx.db.insert("gameSteps", { gameId, order: 0, type: "theory" });
    const id = await ctx.db.insert("gameSessions", {
      answerRevealed: false,
      currentStepIndex: -1,
      gameId,
      hostId,
      inviteCode: "LOBBY1",
      status: "waiting",
    });
    return { sessionId: id, userId: hostId };
  });
  // @convex-dev/auth reads the user from `subject`.
  const host = t.withIdentity({ subject: `${userId}|session` });
  return { host, sessionId };
}

async function joinAs(
  t: TestConvex,
  sessionId: Awaited<ReturnType<typeof seedLobby>>["sessionId"],
  name: string
) {
  const { participantToken } = await t.mutation(api.sessions.join, {
    name,
    sessionId,
  });
  return participantToken;
}

/** Rows of a table, read directly from the database. */
async function rows<Table extends "gameParticipants" | "participantPresence">(
  t: TestConvex,
  table: Table
) {
  return await t.run(async (ctx) => await ctx.db.query(table).collect());
}

describe("lobby presence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("heartbeats keep players listed without touching their participant row", async () => {
    const t = newTest();
    const { host, sessionId } = await seedLobby(t);
    const ada = await joinAs(t, sessionId, "Ada");
    await joinAs(t, sessionId, "Bob");
    const participantsBefore = await rows(t, "gameParticipants");

    vi.advanceTimersByTime(10_000);
    await t.mutation(api.sessions.heartbeat, { participantToken: ada });
    vi.advanceTimersByTime(10_000);

    // Bob's last heartbeat was 20s ago, past the 15s threshold.
    const listed = await host.query(api.sessions.listHostParticipants, {
      sessionId,
    });
    expect(listed.map((p) => p.name)).toEqual(["Ada"]);

    // Queries reading participants (leaderboard, player state) don't re-run.
    expect(await rows(t, "gameParticipants")).toEqual(participantsBefore);
  });

  test("starting the game removes stale players and clears presence", async () => {
    const t = newTest();
    const { host, sessionId } = await seedLobby(t);
    const ada = await joinAs(t, sessionId, "Ada");
    await joinAs(t, sessionId, "Bob");

    vi.advanceTimersByTime(10_000);
    await t.mutation(api.sessions.heartbeat, { participantToken: ada });
    vi.advanceTimersByTime(10_000);
    await host.mutation(api.sessions.advance, { sessionId });

    expect((await rows(t, "gameParticipants")).map((p) => p.name)).toEqual([
      "Ada",
    ]);
    expect(await rows(t, "participantPresence")).toEqual([]);

    // After the start, heartbeats store nothing and everyone stays listed.
    await t.mutation(api.sessions.heartbeat, { participantToken: ada });
    expect(await rows(t, "participantPresence")).toEqual([]);
    vi.advanceTimersByTime(60_000);
    const listed = await host.query(api.sessions.listHostParticipants, {
      sessionId,
    });
    expect(listed.map((p) => p.name)).toEqual(["Ada"]);
  });
});
