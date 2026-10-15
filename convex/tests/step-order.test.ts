/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("step order", () => {
  test("a session plays steps by `order`, not in the order they were created", async () => {
    const t = convexTest(schema, modules);
    // Created out of play order: the quiz (played second) first.
    const { gameId, hostId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "host@x.test" });
      const id = await ctx.db.insert("games", {
        createdById: userId,
        title: "Game",
        updatedAt: 0,
      });
      await ctx.db.insert("gameSteps", {
        choices: [
          { isCorrect: false, text: "No" },
          { isCorrect: true, text: "Yes" },
        ],
        gameId: id,
        order: 1,
        question: "Second?",
        type: "quiz",
      });
      await ctx.db.insert("gameSteps", {
        gameId: id,
        markdownContent: "Third",
        order: 2,
        type: "theory",
      });
      await ctx.db.insert("gameSteps", {
        gameId: id,
        markdownContent: "First",
        order: 0,
        type: "theory",
      });
      return { gameId: id, hostId: userId };
    });
    // @convex-dev/auth reads the user from `subject`.
    const host = t.withIdentity({ subject: `${hostId}|session` });
    const sessionId = await host.mutation(api.sessions.create, { gameId });
    const { participantToken } = await t.mutation(api.sessions.join, {
      name: "Ada",
      sessionId,
    });

    /** The current step as the host and the player see it. */
    async function currentStep() {
      const [view, player] = await Promise.all([
        host.query(api.sessions.getHostView, { sessionId }),
        t.query(api.sessions.getPlayerState, { participantToken, sessionId }),
      ]);
      return [
        view?.currentStep?.markdownContent ?? view?.currentStep?.question,
        player?.currentStep?.markdownContent ?? player?.currentStep?.question,
      ];
    }

    await host.mutation(api.sessions.advance, { sessionId });
    expect(await currentStep()).toEqual(["First", "First"]);

    await host.mutation(api.sessions.advance, { sessionId });
    expect(await currentStep()).toEqual(["Second?", "Second?"]);
    // Answering, counting and revealing act on the quiz played second.
    await t.mutation(api.sessions.submitAnswer, {
      choiceIndex: 1,
      participantToken,
      sessionId,
    });
    expect(
      await host.query(api.sessions.getAnswerCount, { sessionId })
    ).toMatchObject({ answered: 1 });
    await host.mutation(api.sessions.reveal, { sessionId });
    const player = await t.query(api.sessions.getPlayerState, {
      participantToken,
      sessionId,
    });
    expect(player?.currentAnswer).toMatchObject({ isCorrect: true });

    await host.mutation(api.sessions.advance, { sessionId });
    expect(await currentStep()).toEqual(["Third", "Third"]);
  });
});
