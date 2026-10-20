import type { Id } from "@/convex/_generated/dataModel";
import {
  IMAGE_HEADER_BYTES,
  isAnimatedImage,
  scanPngChunks,
} from "@/convex/images";

/** The image types a step accepts: the ones `convex/images.ts` recognizes. */
export const STEP_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
];

/** Largest file the upload route accepts, in bytes (`MAX_IMAGE_BYTES` in `convex/images.ts`). */
export const MAX_STEP_IMAGE_BYTES = 5 * 1024 * 1024;

/** Largest width or height the upload route accepts (`MAX_IMAGE_DIMENSION` in `convex/images.ts`). */
const MAX_STEP_IMAGE_DIMENSION = 10_000;

/** Most pixels the upload route accepts (`MAX_IMAGE_PIXELS` in `convex/images.ts`). */
const MAX_STEP_IMAGE_PIXELS = 4096 * 4096;

/** Longest side, in pixels, of an image shrunk before upload. Plenty for a projector. */
const MAX_EDGE = 1920;

/** Images over this many bytes are re-encoded before upload even if small enough in pixels. */
const SHRINK_ABOVE_BYTES = 1024 * 1024;

/** Quality of a re-encoded image, from 0 to 1. */
const ENCODE_QUALITY = 0.85;

/** Why a step image couldn't be uploaded. */
export type StepImageErrorReason =
  | "rateLimited"
  | "tooLarge"
  | "unreadable"
  | "unsupportedType"
  | "uploadFailed";

/** A step image upload that failed, with the reason to tell the user. */
export class StepImageError extends Error {
  readonly reason: StepImageErrorReason;

  constructor(reason: StepImageErrorReason, options?: ErrorOptions) {
    super(`Step image upload failed: ${reason}`, options);
    this.name = "StepImageError";
    this.reason = reason;
  }
}

/** An image ready to upload, with its size in pixels. */
export interface PreparedStepImage {
  file: Blob;
  height: number;
  width: number;
}

/** `width` × `height` scaled down, keeping its shape, so neither side is over `maxEdge`. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number
): { height: number; width: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, ENCODE_QUALITY);
  });
}

/**
 * `bitmap` drawn at `size` and encoded as WebP, or, where the browser can't encode WebP (Safari),
 * as `fallbackType`. Null if the browser can't draw it.
 */
async function reencode(
  bitmap: ImageBitmap,
  size: { height: number; width: number },
  fallbackType: string
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  const webp = await canvasToBlob(canvas, "image/webp");
  // A browser that can't encode a type returns a PNG instead.
  if (webp?.type === "image/webp") {
    return webp;
  }
  return await canvasToBlob(canvas, fallbackType);
}

/**
 * Whether the PNG `file` is an APNG, following its chunks from `offset` a window at a time, past
 * however much metadata comes before its animation control chunk or image data. Chunks' data is
 * skipped, not read.
 */
async function isAnimatedPng(file: Blob, offset = 8): Promise<boolean> {
  if (offset + 8 > file.size) {
    return false;
  }
  const window = new Uint8Array(
    await file.slice(offset, offset + IMAGE_HEADER_BYTES).arrayBuffer()
  );
  const scan = scanPngChunks(window, offset);
  return "animated" in scan
    ? scan.animated
    : await isAnimatedPng(file, scan.next);
}

/** Whether `file`, of one of `STEP_IMAGE_TYPES`, is animated. */
async function isAnimated(file: File): Promise<boolean> {
  if (file.type === "image/png") {
    return await isAnimatedPng(file);
  }
  const header = new Uint8Array(
    await file.slice(0, IMAGE_HEADER_BYTES).arrayBuffer()
  );
  return isAnimatedImage(header, file.type);
}

/**
 * `file` ready to upload as a step image: photos larger than a projector needs are shrunk and
 * re-encoded, while animated images (GIFs, APNGs, animated WebPs and AVIF sequences) are kept as
 * they are: a canvas would keep only their first frame.
 *
 * @throws {StepImageError} If it isn't an accepted image type, can't be read, or is still too
 *   large.
 */
export async function prepareStepImage(file: File): Promise<PreparedStepImage> {
  if (!STEP_IMAGE_TYPES.includes(file.type)) {
    throw new StepImageError("unsupportedType");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (error) {
    throw new StepImageError("unreadable", { cause: error });
  }

  try {
    const tooBig = Math.max(bitmap.width, bitmap.height) > MAX_EDGE;
    let prepared: PreparedStepImage = {
      file,
      height: bitmap.height,
      width: bitmap.width,
    };
    if (
      !(await isAnimated(file)) &&
      (tooBig || file.size > SHRINK_ABOVE_BYTES)
    ) {
      const size = fitWithin(bitmap.width, bitmap.height, MAX_EDGE);
      // JPEG has no transparency, so other images fall back to PNG.
      const fallbackType =
        file.type === "image/jpeg" ? "image/jpeg" : "image/png";
      const shrunk = await reencode(bitmap, size, fallbackType);
      // Always kept when the image had to shrink in pixels. Otherwise only if
      // it saves bytes: re-encoding a compressed image can make it larger.
      if (shrunk && (tooBig || shrunk.size < file.size)) {
        prepared = { file: shrunk, ...size };
      }
    }
    if (
      prepared.file.size > MAX_STEP_IMAGE_BYTES ||
      Math.max(prepared.width, prepared.height) > MAX_STEP_IMAGE_DIMENSION ||
      prepared.width * prepared.height > MAX_STEP_IMAGE_PIXELS
    ) {
      throw new StepImageError("tooLarge");
    }
    return prepared;
  } finally {
    bitmap.close();
  }
}

const CONVEX_CLOUD_SUFFIX = /\.convex\.cloud\/?$/;

/** The Convex HTTP actions URL: the deployment URL with `.convex.site` for `.convex.cloud`. */
function getConvexSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
    (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(
      CONVEX_CLOUD_SUFFIX,
      ".convex.site"
    )
  );
}

/** The error reason for an upload route response status. */
function reasonForStatus(status: number): StepImageErrorReason {
  if (status === 413) {
    return "tooLarge";
  }
  if (status === 415) {
    return "unsupportedType";
  }
  if (status === 429) {
    return "rateLimited";
  }
  return "uploadFailed";
}

/**
 * Upload `image` as the image of the step `stepId`, replacing any it had, through the `/step-image`
 * route, signed in with the Convex Auth `token`.
 *
 * @throws {StepImageError} If the upload fails or is refused.
 */
export async function uploadStepImage(
  stepId: Id<"gameSteps">,
  image: PreparedStepImage,
  token: string
): Promise<void> {
  const url = new URL("/step-image", getConvexSiteUrl());
  url.searchParams.set("stepId", stepId);
  url.searchParams.set("width", String(image.width));
  url.searchParams.set("height", String(image.height));

  let response: Response;
  try {
    response = await fetch(url, {
      body: image.file,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": image.file.type,
      },
      method: "POST",
    });
  } catch (error) {
    throw new StepImageError("uploadFailed", { cause: error });
  }
  if (!response.ok) {
    throw new StepImageError(reasonForStatus(response.status));
  }
}
