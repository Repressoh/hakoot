// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";
import { encryptImage } from "@/convex/images";
import { preloadStepImageFile, stepImageSource } from "./step-image-source";

const IMAGE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

afterEach(() => {
  vi.unstubAllGlobals();
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
function contents(source: string | null) {
  const [, type, base64] = source?.match(DATA_URL) ?? [];
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

  test("gives null for a file it can't download or decrypt, and tries again later", async () => {
    const { file } = await encryptImage(IMAGE);
    const other = await encryptImage(IMAGE);
    const fetch = serve({ "https://x.test/b": file });
    const image = {
      key: other.key,
      type: "image/png",
      url: "https://x.test/b",
    };

    expect(await stepImageSource(image)).toBe(null);
    expect(await stepImageSource(image)).toBe(null);
    expect(fetch).toHaveBeenCalledTimes(2);

    expect(
      await stepImageSource({ ...image, url: "https://x.test/missing" })
    ).toBe(null);
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
