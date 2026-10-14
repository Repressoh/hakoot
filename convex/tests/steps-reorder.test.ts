/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

/** A fresh in-memory Convex backend for one test. */
function newTest() {
  return convexTest(schema, modules);
}

type TestConvex = ReturnType<typeof newTest>;

/** A user with one game holding two theory steps (order 0 and 1). */
async function seedGame(t: TestConvex, label: string) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: `${label}@x.test` });
    const gameId = await ctx.db.insert("games", {
      createdById: userId,
      title: `${label} game`,
      updatedAt: 0,
    });
    const [first, second] = await Promise.all(
      [0, 1].map((order) =>
        ctx.db.insert("gameSteps", { gameId, order, type: "theory" })
      )
    );
    return { first, gameId, second, userId };
  });
}

/** The `order` of each step, by id. */
async function orders(t: TestConvex, ids: Id<"gameSteps">[]) {
  return await t.run(async (ctx) =>
    Promise.all(ids.map(async (id) => (await ctx.db.get(id))?.order))
  );
}

describe("steps.reorder", () => {
  test("reorders the owner's steps", async () => {
    const t = newTest();
    const alice = await seedGame(t, "alice");

    await t
      .withIdentity({ subject: `${alice.userId}|session` })
      .mutation(api.steps.reorder, {
        gameId: alice.gameId,
        orderedIds: [alice.second, alice.first],
      });

    expect(await orders(t, [alice.first, alice.second])).toEqual([1, 0]);
  });

  test("refuses steps from another user's game", async () => {
    const t = newTest();
    const alice = await seedGame(t, "alice");
    const mallory = await seedGame(t, "mallory");

    // Mallory owns `mallory.gameId`, but slips in Alice's steps
    await expect(
      t
        .withIdentity({ subject: `${mallory.userId}|session` })
        .mutation(api.steps.reorder, {
          gameId: mallory.gameId,
          orderedIds: [mallory.second, alice.second, alice.first],
        })
    ).rejects.toThrow("Not found");

    expect(await orders(t, [alice.first, alice.second])).toEqual([0, 1]);
    expect(await orders(t, [mallory.first, mallory.second])).toEqual([0, 1]);
  });
});
