// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";
import { encryptImage } from "@/convex/images";
import {
  type FailedStepImage,
  preloadStepImageFile,
  releaseStepImageFile,
  stepImageSource,
} from "./step-image-source";

const IMAGE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** A stand-in for `fetch` that serves `files` by URL, counting the requests. */
function serve(files: Record<string, Blob>) {
  const fetch = vi.fn(async (url: string) =>
    files[url] ? new Response(files[url]) : new Response(null, { status: 404 })
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const DATA_URL = /^data:([^;]+);base64,(.*)$/;

/** The type and bytes of the data URL `source`. */
function contents(source: string | FailedStepImage) {
  const [, type, base64] =
    typeof source === "string" ? (source.match(DATA_URL) ?? []) : [];
  return type
    ? { bytes: new Uint8Array(Buffer.from(base64, "base64")), type }
    : null;
}

describe("stepImageSource", () => {
  test("decrypts a preloaded image from the file downloaded ahead", async () => {
    const { file, key } = await encryptImage(IMAGE);
    const fetch = serve({ "https://x.test/a": file });

    preloadStepImageFile("https://x.test/a");
    preloadStepImageFile("https://x.test/a");
    const image = { key, type: "image/png", url: "https://x.test/a" };
    const decrypted = stepImageSource(image);
    expect(contents(await decrypted)).toEqual({
      bytes: IMAGE,
      type: "image/png",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    // The same promise every render, so `use` doesn't suspend again.
    expect(stepImageSource(image)).toBe(decrypted);
  });

  test("gives when to try again for a file it can't download or decrypt, and only tries then", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { file } = await encryptImage(IMAGE);
    const other = await encryptImage(IMAGE);
    const fetch = serve({ "https://x.test/b": file });
    const image = {
      key: other.key,
      type: "image/png",
      url: "https://x.test/b",
    };

    const failed = stepImageSource(image);
    expect(await failed).toEqual({ retryAt: Date.now() + 10_000 });
    // The same settled promise, so a component showing it doesn't suspend
    // and fetch again on every render.
    expect(stepImageSource(image)).toBe(failed);
    vi.advanceTimersByTime(9000);
    expect(stepImageSource(image)).toBe(failed);
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1001);
    // Only a later attempt tries again: a render for anything else (or a
    // memoized call) gets the same failure.
    expect(stepImageSource(image)).toBe(failed);
    expect(stepImageSource(image, 1)).toBe(stepImageSource(image, 1));
    const retried = stepImageSource(image, 1);
    expect(retried).not.toBe(failed);
    expect(await retried).toEqual({ retryAt: Date.now() + 10_000 });
    expect(fetch).toHaveBeenCalledTimes(2);

    expect(
      await stepImageSource({ ...image, url: "https://x.test/missing" })
    ).toMatchObject({ retryAt: expect.any(Number) });
  });

  test("keeps only the two newest preloads, and lets go of released ones", async () => {
    const files: Record<string, Blob> = {};
    const images = await Promise.all(
      [1, 2, 3].map(async (n) => {
        const url = `https://x.test/preload-${n}`;
        const { file, key } = await encryptImage(IMAGE);
        files[url] = file;
        return { key, type: "image/png", url };
      })
    );
    const fetch = serve(files);
    const [first, second, third] = images;

    for (const { url } of images) {
      preloadStepImageFile(url);
    }
    releaseStepImageFile(second.url);
    expect(fetch).toHaveBeenCalledTimes(3);

    // Only the newest is still held: the first was let go, the second released.
    await stepImageSource(third);
    expect(fetch).toHaveBeenCalledTimes(3);
    await stepImageSource(first);
    await stepImageSource(second);
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  test("keeps only the four newest images", async () => {
    const files: Record<string, Blob> = {};
    const images = await Promise.all(
      [1, 2, 3, 4, 5].map(async (n) => {
        const url = `https://x.test/many-${n}`;
        const { file, key } = await encryptImage(IMAGE);
        files[url] = file;
        return { key, type: "image/png", url };
      })
    );
    const fetch = serve(files);

    const [first, ...rest] = images;
    const firstFile = stepImageSource(first);
    await firstFile;
    const restFiles = rest.map((image) => stepImageSource(image));
    await Promise.all(restFiles);
    for (const [i, image] of rest.entries()) {
      expect(stepImageSource(image)).toBe(restFiles[i]);
    }
    expect(fetch).toHaveBeenCalledTimes(5);

    // The oldest was let go: shown again, it is downloaded again.
    expect(stepImageSource(first)).not.toBe(firstFile);
    expect(contents(await stepImageSource(first))).toMatchObject({
      bytes: IMAGE,
    });
    expect(fetch).toHaveBeenCalledTimes(6);
  });
});
