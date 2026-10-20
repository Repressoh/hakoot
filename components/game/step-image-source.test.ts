// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";
import { encryptImage } from "@/convex/images";
import {
  type FailedStepImage,
  holdStepImageFile,
  preloadStepImageFile,
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

/**
 * A stand-in for `fetch` whose responses wait for `respond`, and which rejects once aborted. Returns
 * its calls.
 */
function deferFetch() {
  const calls: {
    respond: (file: Blob) => void;
    signal: AbortSignal;
    url: string;
  }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url: string, init: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const signal = init.signal as AbortSignal;
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
          calls.push({
            respond: (file) => resolve(new Response(file)),
            signal,
            url,
          });
        })
    )
  );
  return calls;
}

/** Let queued microtasks run, as they do once a commit's effects have. */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

    const release = holdStepImageFile("https://x.test/a");
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
    release();
  });

  test("gives when to try again for a file it can't download or decrypt, and only tries then", async () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    const { file } = await encryptImage(IMAGE);
    const other = await encryptImage(IMAGE);
    const fetch = serve({ "https://x.test/b": file });
    const image = {
      key: other.key,
      type: "image/png",
      url: "https://x.test/b",
    };

    // Shown, as `StepImage` holds what it shows.
    holdStepImageFile(image.url);
    holdStepImageFile("https://x.test/missing");
    const failed = stepImageSource(image);
    const failure = await failed;
    expect(failure).toEqual({ retryAt: performance.now() + 10_000 });
    // The same settled promise, so a component showing it doesn't suspend
    // and fetch again on every render; asked to retry too early, too.
    expect(stepImageSource(image)).toBe(failed);
    vi.advanceTimersByTime(9000);
    expect(stepImageSource(image, failure as FailedStepImage)).toBe(failed);
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1001);
    // Only a retry of this failure tries again: a render for anything else
    // (or a memoized call) gets the same failure.
    expect(stepImageSource(image)).toBe(failed);
    const retried = stepImageSource(image, failure as FailedStepImage);
    expect(retried).not.toBe(failed);
    // Every view asking for the same retry gets that one try.
    expect(stepImageSource(image, failure as FailedStepImage)).toBe(retried);
    const second = await retried;
    expect(second).not.toBe(failure);
    expect(second).toEqual({ retryAt: performance.now() + 10_000 });
    expect(fetch).toHaveBeenCalledTimes(2);

    // A view still holding the first failure gets the newer one.
    vi.advanceTimersByTime(10_001);
    expect(stepImageSource(image, failure as FailedStepImage)).toBe(retried);
    expect(fetch).toHaveBeenCalledTimes(2);

    expect(
      await stepImageSource({ ...image, url: "https://x.test/missing" })
    ).toMatchObject({ retryAt: expect.any(Number) });
  });

  test("a render nothing holds downloads nothing", async () => {
    const calls = deferFetch();
    const { file, key } = await encryptImage(IMAGE);
    const image = { key, type: "image/png", url: "https://x.test/unshown" };

    // A render React may throw away.
    const source = stepImageSource(image);
    await settle();
    expect(calls).toHaveLength(0);

    // Shown after all: its hold sends the request.
    const shown = holdStepImageFile(image.url);
    await settle();
    expect(calls).toHaveLength(1);
    calls[0].respond(file);
    expect(contents(await source)).toMatchObject({ bytes: IMAGE });
    shown();
  });

  test("stops a preload nothing needs any more", async () => {
    const calls = deferFetch();
    const release = holdStepImageFile("https://x.test/skipped");
    preloadStepImageFile("https://x.test/skipped");
    await settle();
    expect(calls).toHaveLength(1);

    release();
    await settle();
    expect(calls[0].signal.aborted).toBe(true);
  });

  test("hands a preload over to its image, which keeps it downloading", async () => {
    const calls = deferFetch();
    const { file, key } = await encryptImage(IMAGE);
    const image = { key, type: "image/png", url: "https://x.test/next" };

    const preloader = holdStepImageFile(image.url);
    preloadStepImageFile(image.url);
    // The step starts: its image renders, then the commit's effects run,
    // the preloader's cleanup just before the image's own hold.
    const source = stepImageSource(image);
    preloader();
    const shown = holdStepImageFile(image.url);
    await settle();
    expect(calls[0].signal.aborted).toBe(false);

    calls[0].respond(file);
    expect(contents(await source)).toMatchObject({ bytes: IMAGE });
    expect(calls).toHaveLength(1);
    shown();
  });

  test("an image let go before it arrived starts over when shown again", async () => {
    const calls = deferFetch();
    const { file, key } = await encryptImage(IMAGE);
    const image = { key, type: "image/png", url: "https://x.test/passed" };

    const first = holdStepImageFile(image.url);
    const abandoned = stepImageSource(image);
    first();
    await settle();
    expect(calls[0].signal.aborted).toBe(true);

    // Not a failure to wait out: a new download.
    const again = holdStepImageFile(image.url);
    const source = stepImageSource(image);
    expect(source).not.toBe(abandoned);
    await settle();
    expect(calls).toHaveLength(2);
    calls[1].respond(file);
    expect(contents(await source)).toMatchObject({ bytes: IMAGE });
    again();
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

    for (const { url } of images) {
      holdStepImageFile(url);
    }
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
