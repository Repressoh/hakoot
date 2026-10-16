/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

/** A user's game with one theory and one quiz step, and a client signed in as the user. */
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "host@x.test" });
    const gameId = await ctx.db.insert("games", {
      createdById: userId,
      title: "Game",
      updatedAt: 0,
    });
    const theoryId = await ctx.db.insert("gameSteps", {
      codeBlock: {
        annotations: [{ explanation: "Ex", label: "Lb", lines: [1] }],
        code: "let a = 1;",
        language: "typescript",
      },
      gameId,
      markdownContent: "Hello",
      order: 0,
      type: "theory",
    });
    const quizId = await ctx.db.insert("gameSteps", {
      gameId,
      order: 1,
      question: "Q?",
      timeLimitSeconds: 30,
      type: "quiz",
    });
    return { quizId, theoryId, userId };
  });
  const host = t.withIdentity({ subject: `${ids.userId}|session` });
  const stepFields = (id: typeof ids.theoryId) =>
    t.run(async (ctx) => await ctx.db.get(id));
  return { host, quizId: ids.quizId, stepFields, theoryId: ids.theoryId };
}

// The payloads the step editors' autosave sends.
describe("step autosave payloads", () => {
  test("a half-typed annotation range is stored as typed", async () => {
    const { host, stepFields, theoryId } = await setup();

    await host.mutation(api.steps.updateTheory, {
      codeBlock: {
        annotations: [
          { explanation: "", label: "Partial", lines: [], linesText: "5-" },
        ],
        code: "let a = 1;",
        language: "typescript",
      },
      markdownContent: "Hello",
      stepId: theoryId,
    });

    expect((await stepFields(theoryId))?.codeBlock?.annotations).toEqual([
      { explanation: "", label: "Partial", lines: [], linesText: "5-" },
    ]);
  });

  test("an enabled code block is kept while its code is empty", async () => {
    const { host, stepFields, theoryId } = await setup();

    await host.mutation(api.steps.updateTheory, {
      codeBlock: {
        annotations: [{ explanation: "Ex", label: "Lb", lines: [1] }],
        code: "",
        language: "typescript",
      },
      markdownContent: "Hello",
      stepId: theoryId,
    });

    expect((await stepFields(theoryId))?.codeBlock).toMatchObject({
      annotations: [{ label: "Lb" }],
      code: "",
    });
  });

  test("switching the code block off removes it", async () => {
    const { host, stepFields, theoryId } = await setup();

    await host.mutation(api.steps.updateTheory, {
      codeBlock: null,
      markdownContent: "Hello",
      stepId: theoryId,
    });

    expect((await stepFields(theoryId))?.codeBlock).toBeUndefined();
  });

  test("choosing no time limit removes it", async () => {
    const { host, quizId, stepFields } = await setup();

    await host.mutation(api.steps.updateQuiz, {
      choices: [],
      question: "Q?",
      stepId: quizId,
      timeLimitSeconds: null,
    });

    expect((await stepFields(quizId))?.timeLimitSeconds).toBeUndefined();
  });
});
