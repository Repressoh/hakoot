/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { MAX_IMAGE_BYTES, sniffImageType } from "../images";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function newTest() {
  return convexTest({ modules, schema, transactionLimits: true });
}

type TestConvex = ReturnType<typeof newTest>;
type AsUser = ReturnType<TestConvex["withIdentity"]>;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** `size` bytes that start like `prefix`. */
function bytes(prefix: number[] | string, size = 64): Uint8Array<ArrayBuffer> {
  const start =
    typeof prefix === "string"
      ? [...prefix].map((char) => char.charCodeAt(0))
      : prefix;
  const result = new Uint8Array(Math.max(size, start.length));
  result.set(start);
  return result;
}

/** The first bytes of an ISO base media file with `majorBrand` and `compatibleBrands`. */
function ftyp(majorBrand: string, compatibleBrands: string[] = []) {
  const box = `ftyp${majorBrand}\0\0\0\0${compatibleBrands.join("")}`;
  const size = 4 + box.length;
  return bytes([0, 0, 0, size, ...[...box].map((char) => char.charCodeAt(0))]);
}

const png = (size = 64) => bytes(PNG_SIGNATURE, size);

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

/** A game owned by `ownerId` with a theory step and a quiz step. */
async function seedGame(t: TestConvex, ownerId: Id<"users">) {
  return await t.run(async (ctx) => {
    const gameId = await ctx.db.insert("games", {
      createdById: ownerId,
      title: "Pictures",
      updatedAt: 0,
    });
    const theoryId = await ctx.db.insert("gameSteps", {
      gameId,
      markdownContent: "# Look",
      order: 0,
      type: "theory",
    });
    const quizId = await ctx.db.insert("gameSteps", {
      choices: [
        { isCorrect: true, text: "A cat" },
        { isCorrect: false, text: "A dog" },
      ],
      gameId,
      order: 1,
      question: "What is it?",
      type: "quiz",
    });
    return { gameId, quizId, theoryId };
  });
}

/** POST `body` to the upload route as `as` (or signed out), for `stepId`. */
async function upload(
  t: TestConvex | AsUser,
  stepId: string,
  body: Uint8Array<ArrayBuffer>,
  { height = 300, type = "image/png", width = 400 } = {}
) {
  const query = new URLSearchParams({
    height: String(height),
    stepId,
    width: String(width),
  });
  return await t.fetch(`/step-image?${query}`, {
    body: new Blob([body], { type }),
    headers: { "Content-Type": type },
    method: "POST",
  });
}

async function storedFiles(t: TestConvex) {
  return await t.run(
    async (ctx) => await ctx.db.system.query("_storage").collect()
  );
}

/** Set the alt text of the image `stepId` shows now. */
async function setAlt(
  as: AsUser,
  t: TestConvex,
  stepId: Id<"gameSteps">,
  alt: string
) {
  const step = await getStep(t, stepId);
  if (!step?.image) {
    throw new Error("the step has no image");
  }
  await as.mutation(api.steps.setImageAlt, {
    alt,
    stepId,
    storageId: step.image.storageId,
  });
}

async function getStep(t: TestConvex, stepId: Id<"gameSteps">) {
  return await t.run(async (ctx) => await ctx.db.get(stepId));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("sniffImageType", () => {
  test("tells PNG, JPEG, GIF, WebP and AVIF images from their signatures", () => {
    expect(sniffImageType(png())).toBe("image/png");
    expect(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(bytes("GIF89a"))).toBe("image/gif");
    expect(sniffImageType(bytes("GIF87a"))).toBe("image/gif");
    expect(sniffImageType(bytes("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(ftyp("avif"))).toBe("image/avif");
    expect(sniffImageType(ftyp("avis"))).toBe("image/avif");
    expect(sniffImageType(ftyp("mif1", ["miaf", "avif"]))).toBe("image/avif");
  });

  test("refuses SVG, other files and files too short to tell", () => {
    expect(
      sniffImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))
    ).toBe(null);
    expect(sniffImageType(bytes("%PDF-1.7"))).toBe(null);
    // HEIC shares AVIF's container, not its brand.
    expect(sniffImageType(ftyp("heic", ["mif1", "heic"]))).toBe(null);
    expect(sniffImageType(new Uint8Array([0x89, 0x50]))).toBe(null);
    expect(sniffImageType(new Uint8Array())).toBe(null);
  });
});

describe("uploading a step image", () => {
  test("stores the image with the type its bytes show and shows it on the step", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const { theoryId } = await seedGame(t, owner.userId);

    // Sent as a JPEG, but its bytes are a PNG's.
    const response = await upload(owner.as, theoryId, png(), {
      type: "image/jpeg",
    });
    expect(response.status).toBe(200);

    const [file] = await storedFiles(t);
    const type = await t.run(
      async (ctx) => (await ctx.storage.get(file._id))?.type ?? null
    );
    expect(type).toBe("image/png");
    const step = await owner.as.query(api.steps.get, { stepId: theoryId });
    expect(step?.image).toEqual({
      alt: "",
      height: 300,
      storageId: file._id,
      url: expect.stringContaining("/api/storage/"),
      width: 400,
    });
  });

  test("refuses signed-out users, other users' steps and unknown steps, storing nothing", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const other = await signUp(t, "other@x.test");
    const { gameId, theoryId } = await seedGame(t, owner.userId);

    expect((await upload(t, theoryId, png())).status).toBe(401);
    expect((await upload(other.as, theoryId, png())).status).toBe(404);
    expect((await upload(owner.as, "not-an-id", png())).status).toBe(404);
    // An id of another table.
    expect((await upload(owner.as, gameId, png())).status).toBe(404);

    expect(await storedFiles(t)).toEqual([]);
    expect((await getStep(t, theoryId))?.image).toBeUndefined();
  });

  test.each([{ width: 0 }, { height: -5 }, { width: 1.5 }, { height: 10_001 }])(
    "refuses an impossible size: %o",
    async (size) => {
      const t = newTest();
      const owner = await signUp(t, "owner@x.test");
      const { theoryId } = await seedGame(t, owner.userId);

      expect((await upload(owner.as, theoryId, png(), size)).status).toBe(400);
      expect(await storedFiles(t)).toEqual([]);
    }
  );

  test("refuses an upload without a size", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const { theoryId } = await seedGame(t, owner.userId);

    const query = new URLSearchParams({ stepId: theoryId });
    const noSize = await owner.as.fetch(`/step-image?${query}`, {
      body: new Blob([png()]),
      method: "POST",
    });
    expect(noSize.status).toBe(400);
    expect(await storedFiles(t)).toEqual([]);
  });

  test("refuses files over the size limit and files that aren't images", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const { theoryId } = await seedGame(t, owner.userId);

    const tooLarge = await upload(owner.as, theoryId, png(MAX_IMAGE_BYTES + 1));
    expect(tooLarge.status).toBe(413);
    expect(
      (await upload(owner.as, theoryId, png(MAX_IMAGE_BYTES))).status
    ).toBe(200);

    const svg = bytes('<svg xmlns="http://www.w3.org/2000/svg"><script/>');
    const refused = await upload(owner.as, theoryId, svg, {
      type: "image/svg+xml",
    });
    expect(refused.status).toBe(415);
    expect(await storedFiles(t)).toHaveLength(1);
  });

  test("cuts off a streamed body over the limit, whatever its Content-Length says", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const { theoryId } = await seedGame(t, owner.userId);

    const chunk = png(1024 * 1024);
    let pulled = 0;
    // Sent without a length: it never ends on its own.
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(chunk);
      },
    });
    const query = new URLSearchParams({
      height: "300",
      stepId: theoryId,
      width: "400",
    });
    const response = await owner.as.fetch(`/step-image?${query}`, {
      body: endless,
      // @ts-expect-error: needed to send a stream; not yet in RequestInit's types.
      duplex: "half",
      headers: { "Content-Length": "100" },
      method: "POST",
    });
    expect(response.status).toBe(413);
    // Stopped reading just past the limit.
    expect(pulled).toBeLessThanOrEqual(MAX_IMAGE_BYTES / chunk.length + 2);
    expect(await storedFiles(t)).toEqual([]);
  });

  test("deletes the stored file if the step goes away during the upload", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const { theoryId } = await seedGame(t, owner.userId);

    let sent = false;
    let preparedBeforeDeletion = false;
    // Pulled only once the route reads the body (no read-ahead), which it
    // does after accepting the upload: the step is deleted then, so the file
    // gets stored and attaching it is what fails.
    const body = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          if (sent) {
            controller.close();
            return;
          }
          // The upload was counted: preparing it is done.
          const counted = await t.run(
            async (ctx) => await ctx.db.query("rateLimits").first()
          );
          preparedBeforeDeletion = counted?.attempts === 1;
          await owner.as.mutation(api.steps.remove, { stepId: theoryId });
          controller.enqueue(png());
          sent = true;
        },
      },
      { highWaterMark: 0 }
    );
    const query = new URLSearchParams({
      height: "300",
      stepId: theoryId,
      width: "400",
    });
    const response = await owner.as.fetch(`/step-image?${query}`, {
      body,
      // @ts-expect-error: needed to send a stream; not yet in RequestInit's types.
      duplex: "half",
      method: "POST",
    });
    expect(preparedBeforeDeletion).toBe(true);
    expect(response.status).toBe(404);
    expect(await storedFiles(t)).toEqual([]);
  });

  test("limits each user to 20 uploads a minute", async () => {
    vi.useFakeTimers();
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const { theoryId } = await seedGame(t, owner.userId);

    await repeat(20, async () => {
      expect((await upload(owner.as, theoryId, png())).status).toBe(200);
    });
    expect((await upload(owner.as, theoryId, png())).status).toBe(429);

    vi.advanceTimersByTime(60_001);
    expect((await upload(owner.as, theoryId, png())).status).toBe(200);
    // Each upload replaced the one before.
    expect(await storedFiles(t)).toHaveLength(1);
  });

  test("answers CORS preflights for the app's origins", async () => {
    const t = newTest();
    const response = await t.fetch("/step-image", {
      headers: { Origin: "http://localhost:3000" },
      method: "OPTIONS",
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "Authorization"
    );
  });
});

describe("replacing and removing a step image", () => {
  test("a new image replaces the old one, whose file is deleted, and starts without alt text", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const { theoryId } = await seedGame(t, owner.userId);

    await upload(owner.as, theoryId, png());
    await setAlt(owner.as, t, theoryId, "A cat");
    const [first] = await storedFiles(t);

    await upload(owner.as, theoryId, png(), { height: 50, width: 80 });
    const files = await storedFiles(t);
    expect(files).toHaveLength(1);
    expect(files[0]._id).not.toBe(first._id);
    expect((await getStep(t, theoryId))?.image).toEqual({
      height: 50,
      storageId: files[0]._id,
      width: 80,
    });
  });

  test("removing the image deletes its file; only the owner can remove it", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const other = await signUp(t, "other@x.test");
    const { quizId } = await seedGame(t, owner.userId);
    await upload(owner.as, quizId, png());

    await expect(
      other.as.mutation(api.steps.removeImage, { stepId: quizId })
    ).rejects.toThrow("Not found");
    expect(await storedFiles(t)).toHaveLength(1);

    await owner.as.mutation(api.steps.removeImage, { stepId: quizId });
    expect(await storedFiles(t)).toEqual([]);
    expect((await getStep(t, quizId))?.image).toBeUndefined();
    // Nothing left to remove.
    await owner.as.mutation(api.steps.removeImage, { stepId: quizId });
  });

  test("deleting a step deletes its image's file", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const { theoryId } = await seedGame(t, owner.userId);
    await upload(owner.as, theoryId, png());

    await owner.as.mutation(api.steps.remove, { stepId: theoryId });
    expect(await storedFiles(t)).toEqual([]);
  });
});

describe("alt text", () => {
  test("is set on the image, trimmed and capped; empty removes it", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const { quizId, theoryId } = await seedGame(t, owner.userId);
    await upload(owner.as, theoryId, png());
    await upload(owner.as, quizId, png());

    await setAlt(owner.as, t, theoryId, "  A diagram  ");
    await setAlt(owner.as, t, quizId, "x".repeat(600));
    expect((await getStep(t, theoryId))?.image?.alt).toBe("A diagram");
    expect((await getStep(t, quizId))?.image?.alt).toBe("x".repeat(500));
    const view = await owner.as.query(api.steps.get, { stepId: theoryId });
    expect(view?.image).toMatchObject({
      alt: "A diagram",
      storageId: (await getStep(t, theoryId))?.image?.storageId,
    });

    await setAlt(owner.as, t, theoryId, "");
    expect((await getStep(t, theoryId))?.image?.alt).toBeUndefined();
  });

  test("a save made for a replaced or removed image is dropped", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const { theoryId } = await seedGame(t, owner.userId);
    await upload(owner.as, theoryId, png());
    const old = (await getStep(t, theoryId))?.image?.storageId;
    if (!old) {
      throw new Error("no image");
    }

    // Another tab replaces the image, then this tab's autosave lands.
    await upload(owner.as, theoryId, png());
    await owner.as.mutation(api.steps.setImageAlt, {
      alt: "The old picture",
      stepId: theoryId,
      storageId: old,
    });
    expect((await getStep(t, theoryId))?.image?.alt).toBeUndefined();

    await owner.as.mutation(api.steps.removeImage, { stepId: theoryId });
    await owner.as.mutation(api.steps.setImageAlt, {
      alt: "Nothing to describe",
      stepId: theoryId,
      storageId: old,
    });
    expect((await getStep(t, theoryId))?.image).toBeUndefined();
  });

  test("only the owner can set it, and other edits leave it alone", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const other = await signUp(t, "other@x.test");
    const { theoryId } = await seedGame(t, owner.userId);
    await upload(owner.as, theoryId, png());
    await setAlt(owner.as, t, theoryId, "Kept");

    await expect(setAlt(other.as, t, theoryId, "Mine now")).rejects.toThrow(
      "Not found"
    );
    await owner.as.mutation(api.steps.updateTheory, {
      markdownContent: "# Changed",
      stepId: theoryId,
    });
    expect((await getStep(t, theoryId))?.image?.alt).toBe("Kept");
  });
});

describe("images in sessions", () => {
  test("the host and the players get the current step's image", async () => {
    const t = newTest();
    const owner = await signUp(t, "owner@x.test");
    const { gameId, theoryId } = await seedGame(t, owner.userId);
    await upload(owner.as, theoryId, png());
    await setAlt(owner.as, t, theoryId, "A cat");

    const sessionId = await owner.as.mutation(api.sessions.create, { gameId });
    const session = await t.run(async (ctx) => await ctx.db.get(sessionId));
    const player = await t.mutation(api.sessions.joinByCode, {
      inviteCode: session?.inviteCode ?? "",
      name: "Ada",
    });
    await owner.as.mutation(api.sessions.advance, { sessionId });

    const expected = {
      alt: "A cat",
      height: 300,
      url: expect.stringContaining("/api/storage/"),
      width: 400,
    };
    const hostView = await owner.as.query(api.sessions.getHostView, {
      sessionId,
    });
    expect(hostView?.currentStep?.image).toEqual(expected);
    const playerState = await t.query(api.sessions.getPlayerState, {
      participantToken: player.participantToken,
      sessionId,
    });
    expect(playerState?.currentStep?.image).toEqual(expected);
  });
});

describe("images of copied games", () => {
  /** An owner's game with images on both steps, shared and copied by another user. */
  async function seedCopiedGame(t: TestConvex) {
    const owner = await signUp(t, "owner@x.test");
    const copier = await signUp(t, "copier@x.test");
    const original = await seedGame(t, owner.userId);
    await upload(owner.as, original.theoryId, png());
    await upload(owner.as, original.quizId, png());
    await owner.as.mutation(api.sharing.setShareEnabled, {
      enabled: true,
      gameId: original.gameId,
    });
    const view = await owner.as.query(api.games.getEditorView, {
      gameId: original.gameId,
    });
    const copyId = await copier.as.mutation(api.sharing.copySharedGame, {
      shareToken: view?.shareToken ?? "",
    });
    const copySteps = await t.run(
      async (ctx) =>
        await ctx.db
          .query("gameSteps")
          .withIndex("by_game_and_order", (q) => q.eq("gameId", copyId))
          .collect()
    );
    return { copier, copyId, copySteps, original, owner };
  }

  test("a copy shows the same files, kept while either game shows them", async () => {
    const t = newTest();
    const { copier, copySteps, original, owner } = await seedCopiedGame(t);
    expect(await storedFiles(t)).toHaveLength(2);
    const originalTheory = await getStep(t, original.theoryId);
    expect(copySteps[0].image).toEqual(originalTheory?.image);

    // Removed from the original: the copy still shows it.
    await owner.as.mutation(api.steps.removeImage, {
      stepId: original.theoryId,
    });
    expect(await storedFiles(t)).toHaveLength(2);
    const copyView = await copier.as.query(api.steps.get, {
      stepId: copySteps[0]._id,
    });
    expect(copyView?.image?.url).toEqual(expect.any(String));

    // Replaced in the copy: no step shows the first file any more.
    await upload(copier.as, copySteps[0]._id, png());
    const files = await storedFiles(t);
    expect(files).toHaveLength(2);
    expect(files.map((file) => file._id)).not.toContain(
      originalTheory?.image?.storageId
    );
  });

  test("deleting a game deletes the files only it showed", async () => {
    vi.useFakeTimers();
    const t = newTest();
    const { copier, copyId, original, owner } = await seedCopiedGame(t);
    await upload(owner.as, original.quizId, png());
    // The original's theory image is shared; its new quiz image isn't.
    expect(await storedFiles(t)).toHaveLength(3);

    await owner.as.mutation(api.games.remove, { gameId: original.gameId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await storedFiles(t)).toHaveLength(2);

    await copier.as.mutation(api.games.remove, { gameId: copyId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await storedFiles(t)).toEqual([]);
  });
});
