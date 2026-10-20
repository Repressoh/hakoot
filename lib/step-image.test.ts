// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  fitWithin,
  prepareStepImage,
  StepImageError,
  uploadStepImage,
} from "./step-image";

const STEP_ID = "step123" as Id<"gameSteps">;
const DERIVED_UPLOAD_URL = /^https:\/\/demo\.convex\.site\/step-image\?/;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fitWithin", () => {
  test("scales the longer side down to the limit, keeping the shape", () => {
    expect(fitWithin(4000, 3000, 1920)).toEqual({ height: 1440, width: 1920 });
    expect(fitWithin(1000, 5000, 1920)).toEqual({ height: 1920, width: 384 });
  });

  test("leaves images within the limit alone", () => {
    expect(fitWithin(800, 600, 1920)).toEqual({ height: 600, width: 800 });
    expect(fitWithin(1920, 1920, 1920)).toEqual({ height: 1920, width: 1920 });
  });

  test("never rounds a side down to nothing", () => {
    expect(fitWithin(100_000, 10, 1920)).toEqual({ height: 1, width: 1920 });
  });
});

describe("prepareStepImage", () => {
  test.each(["image/svg+xml", "image/heic", "application/pdf", ""])(
    "refuses a %j file before reading it",
    async (type) => {
      const createImageBitmap = vi.fn();
      vi.stubGlobal("createImageBitmap", createImageBitmap);

      const file = new File(["x"], "file", { type });
      await expect(prepareStepImage(file)).rejects.toMatchObject({
        reason: "unsupportedType",
      });
      expect(createImageBitmap).not.toHaveBeenCalled();
    }
  );

  test("refuses files the browser can't decode", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockRejectedValue(new Error("bad image"))
    );
    const file = new File(["not really a png"], "a.png", { type: "image/png" });
    await expect(prepareStepImage(file)).rejects.toMatchObject({
      reason: "unreadable",
    });
  });

  test("uploads small images and GIFs as they are", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ close, height: 3000, width: 4000 })
    );
    // Large in pixels, but re-encoding would lose the animation.
    const gif = new File(["GIF89a"], "a.gif", { type: "image/gif" });
    await expect(prepareStepImage(gif)).resolves.toEqual({
      file: gif,
      height: 3000,
      width: 4000,
    });
    expect(close).toHaveBeenCalled();

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ close, height: 600, width: 800 })
    );
    const png = new File(["small"], "a.png", { type: "image/png" });
    await expect(prepareStepImage(png)).resolves.toEqual({
      file: png,
      height: 600,
      width: 800,
    });
  });

  test("refuses a GIF over the size limit", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ close: vi.fn(), height: 10, width: 10 })
    );
    const gif = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "a.gif", {
      type: "image/gif",
    });
    await expect(prepareStepImage(gif)).rejects.toMatchObject({
      reason: "tooLarge",
    });
  });
});

/**
 * Stand-ins for `createImageBitmap` and a canvas whose `toBlob` returns `encoded(type)`, so
 * re-encoding can run outside a browser. Returns the types `toBlob` was asked for.
 */
function stubCanvas(
  size: { height: number; width: number },
  encoded: (type: string) => Blob | null
) {
  const requestedTypes: string[] = [];
  const canvas = {
    getContext: () => ({ drawImage: vi.fn() }),
    height: 0,
    toBlob: (callback: (blob: Blob | null) => void, type: string) => {
      requestedTypes.push(type);
      callback(encoded(type));
    },
    width: 0,
  };
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ close: vi.fn(), ...size })
  );
  vi.stubGlobal("document", { createElement: () => canvas });
  return { canvas, requestedTypes };
}

/** A blob of `type` that is `size` bytes long. */
function blobOf(size: number, type: string) {
  return new Blob([new Uint8Array(size)], { type });
}

describe("prepareStepImage re-encoding", () => {
  test("shrinks an image too large in pixels to 1920 pixels, even if that takes more bytes", async () => {
    const { canvas } = stubCanvas({ height: 3000, width: 4000 }, (type) =>
      blobOf(500_000, type)
    );
    const file = new File([new Uint8Array(100_000)], "a.png", {
      type: "image/png",
    });

    const prepared = await prepareStepImage(file);
    expect(prepared).toMatchObject({ height: 1440, width: 1920 });
    expect(prepared.file.type).toBe("image/webp");
    expect(canvas).toMatchObject({ height: 1440, width: 1920 });
  });

  test("re-encodes a heavy image small enough in pixels only if that saves bytes", async () => {
    const heavy = new File([new Uint8Array(2_000_000)], "a.jpg", {
      type: "image/jpeg",
    });
    stubCanvas({ height: 800, width: 1000 }, (type) => blobOf(300_000, type));
    const smaller = await prepareStepImage(heavy);
    expect(smaller.file.size).toBe(300_000);
    expect(smaller).toMatchObject({ height: 800, width: 1000 });

    stubCanvas({ height: 800, width: 1000 }, (type) => blobOf(3_000_000, type));
    expect((await prepareStepImage(heavy)).file).toBe(heavy);
  });

  test("falls back to JPEG for photos, and PNG for the rest, where WebP can't be encoded", async () => {
    // Like Safari: asked for WebP, the canvas returns a PNG.
    const encoded = (type: string) =>
      blobOf(1000, type === "image/webp" ? "image/png" : type);

    const jpeg = stubCanvas({ height: 3000, width: 4000 }, encoded);
    const photo = await prepareStepImage(
      new File(["x"], "a.jpg", { type: "image/jpeg" })
    );
    expect(jpeg.requestedTypes).toEqual(["image/webp", "image/jpeg"]);
    expect(photo.file.type).toBe("image/jpeg");

    const png = stubCanvas({ height: 3000, width: 4000 }, encoded);
    const drawing = await prepareStepImage(
      new File(["x"], "a.png", { type: "image/png" })
    );
    expect(png.requestedTypes).toEqual(["image/webp", "image/png"]);
    expect(drawing.file.type).toBe("image/png");
  });

  test("refuses an image the browser can't shrink that is still over the limits", async () => {
    // A GIF is never re-encoded.
    stubCanvas({ height: 100, width: 12_000 }, () => null);
    await expect(
      prepareStepImage(new File(["GIF89a"], "a.gif", { type: "image/gif" }))
    ).rejects.toMatchObject({ reason: "tooLarge" });
  });

  test.each([
    [
      "an APNG",
      "image/png",
      // Signature, then an animation control chunk before any image data.
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 8, ..."acTL"],
    ],
    [
      "an animated WebP",
      "image/webp",
      // Extended header with its animation flag set.
      [..."RIFF\0\0\0\0WEBPVP8X\0\0\0\0", 0x02],
    ],
    ["an AVIF image sequence", "image/avif", [0, 0, 0, 16, ..."ftypavis"]],
  ])(
    "keeps %s as it is, however large, so it stays animated",
    async (_name, type, start) => {
      const { requestedTypes } = stubCanvas(
        { height: 3000, width: 4000 },
        (t) => blobOf(1000, t)
      );
      const header = start.map((byte) =>
        typeof byte === "string" ? byte.charCodeAt(0) : byte
      );
      const file = new File(
        [new Uint8Array(header), new Uint8Array(2_000_000)],
        "a",
        {
          type,
        }
      );
      await expect(prepareStepImage(file)).resolves.toEqual({
        file,
        height: 3000,
        width: 4000,
      });
      expect(requestedTypes).toEqual([]);
    }
  );
});

describe("uploadStepImage", () => {
  const image = {
    file: new Blob(["png"], { type: "image/png" }),
    height: 300,
    width: 400,
  };

  test("posts the file with its size and the auth token to the upload route", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "https://demo.convex.site");
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);

    await uploadStepImage(STEP_ID, image, "jwt");

    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(
      "https://demo.convex.site/step-image?stepId=step123&width=400&height=300"
    );
    expect(init).toMatchObject({
      body: image.file,
      headers: { Authorization: "Bearer jwt", "Content-Type": "image/png" },
      method: "POST",
    });
  });

  test("finds the upload route from the deployment URL when no site URL is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://demo.convex.cloud");
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);

    await uploadStepImage(STEP_ID, image, "jwt");
    expect(String(fetch.mock.calls[0][0])).toMatch(DERIVED_UPLOAD_URL);
  });

  test.each([
    [413, "tooLarge"],
    [415, "unsupportedType"],
    [429, "rateLimited"],
    [401, "uploadFailed"],
    [404, "uploadFailed"],
    [500, "uploadFailed"],
  ])("reports a %i response as %s", async (status, reason) => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "https://demo.convex.site");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status }))
    );
    const upload = uploadStepImage(STEP_ID, image, "jwt");
    await expect(upload).rejects.toBeInstanceOf(StepImageError);
    await expect(upload).rejects.toMatchObject({ reason });
  });

  test("reports a network failure", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "https://demo.convex.site");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(uploadStepImage(STEP_ID, image, "jwt")).rejects.toMatchObject({
      reason: "uploadFailed",
    });
  });
});
