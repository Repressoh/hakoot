import { getAuthUserId } from "@convex-dev/auth/server";
import { httpRouter } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, httpAction } from "./_generated/server";
import { auth } from "./auth";
import {
  type ImageSize,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  readImageSize,
  sniffImageType,
} from "./images";

const http = httpRouter();

auth.addHttpRoutes(http);

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  "https://dev.hakoot.albertocaserta.it",
  "https://hakoot-dev.albertocaserta.it",
  "https://hakoot.albertocaserta.it",
]);

/** The origin of `url`, or null if it isn't a URL. */
function originOf(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Whether the app at `origin` may call the routes below: one of the known deployments, or the
 * app this Convex deployment serves, wherever it is hosted. That is `SITE_URL`, which Convex Auth
 * requires, or `NEXT_PUBLIC_APP_URL`, which invite emails link to.
 */
function isAllowedOrigin(origin: string): boolean {
  return (
    ALLOWED_ORIGINS.has(origin) ||
    origin === originOf(process.env.SITE_URL) ||
    origin === originOf(process.env.NEXT_PUBLIC_APP_URL)
  );
}

/** Request headers the routes below accept: the upload route also takes the
 * user's auth token. */
type AllowedHeaders = "Content-Type" | "Authorization, Content-Type";

/** CORS headers for the routes below. Shared by the preflights and the POSTs
 * so the browser gets the same answer to both. */
function corsHeaders(
  origin: string | null,
  allowedHeaders: AllowedHeaders = "Content-Type"
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": allowedHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/** JSON response with the CORS headers for `origin`. */
function jsonResponse(
  origin: string | null,
  body: unknown,
  status: number,
  allowedHeaders?: AllowedHeaders
): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders(origin, allowedHeaders),
      "Content-Type": "application/json",
    },
    status,
  });
}

/** Parse the request body as JSON, returning its fields (empty if it isn't a JSON object). */
async function readJsonFields(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

http.route({
  handler: httpAction(async (_ctx, req) => {
    const origin = req.headers.get("origin");

    const fields = await readJsonFields(req);
    const token = typeof fields.token === "string" ? fields.token : "";
    const remoteip =
      typeof fields.remoteip === "string" ? fields.remoteip : undefined;

    if (!token) {
      return jsonResponse(
        origin,
        { error: "Token is required", success: false },
        400
      );
    }

    const formData = new FormData();
    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
      return jsonResponse(
        origin,
        { error: "Server configuration error", success: false },
        500
      );
    }

    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteip) {
      formData.append("remoteip", remoteip);
    }

    try {
      const result = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          body: formData,
          method: "POST",
        }
      );

      if (!result.ok) {
        throw new Error(`Turnstile siteverify failed: ${result.status}`);
      }

      const outcome = await result.json();

      return jsonResponse(origin, outcome, 200);
    } catch {
      return jsonResponse(
        origin,
        { error: "Verification failed", success: false },
        500
      );
    }
  }),
  method: "POST",
  path: "/verify-turnstile",
});

/** Answers a CORS preflight for a route that accepts `allowedHeaders`. */
function preflight(allowedHeaders?: AllowedHeaders) {
  return httpAction(
    async (_ctx, req) =>
      new Response(null, {
        headers: {
          ...corsHeaders(req.headers.get("origin"), allowedHeaders),
          "Access-Control-Max-Age": "86400",
        },
        status: 204,
      })
  );
}

http.route({
  handler: preflight(),
  method: "OPTIONS",
  path: "/verify-turnstile",
});

const UPLOAD_HEADERS: AllowedHeaders = "Authorization, Content-Type";

/** HTTP status for an error thrown by the step image mutations. */
function imageErrorStatus(error: unknown): number {
  if (!(error instanceof ConvexError)) {
    console.error("Step image upload failed", error);
    return 500;
  }
  if (error.data === "Unauthorized") {
    return 401;
  }
  if (error.data === "Not found") {
    return 404;
  }
  // The only other one: the rate limit.
  return 429;
}

/** A whole number of pixels from the upload URL, or null if it isn't a usable image size. */
function parseDimension(value: string | null): number | null {
  const pixels = Number(value);
  return Number.isInteger(pixels) && pixels > 0 && pixels <= MAX_IMAGE_DIMENSION
    ? pixels
    : null;
}

/**
 * Whether `declared`, the size the editor sent, is the size `stored` that the file's header
 * gives, either way round: a photo turned by its EXIF orientation shows with its sides swapped.
 */
function matchesStoredSize(declared: ImageSize, stored: ImageSize): boolean {
  return (
    (declared.width === stored.width && declared.height === stored.height) ||
    (declared.width === stored.height && declared.height === stored.width)
  );
}

/**
 * Most chunks an upload's body may arrive in. A browser's arrive in far fewer; a body cut into
 * tiny chunks would otherwise take millions of reads.
 */
const MAX_BODY_CHUNKS = 16_384;

/** Bytes set aside for a body at first; doubled as more arrive. */
const INITIAL_BODY_BUFFER = 64 * 1024;

/**
 * `body`'s bytes, read into one buffer as they arrive. Stops reading as soon as they add up to more
 * than `limit` bytes ("tooLarge"), so an oversized body is never held in memory whole, or once
 * they take more than `MAX_BODY_CHUNKS` chunks ("tooManyChunks").
 */
async function readBody(
  body: ReadableStream<Uint8Array<ArrayBuffer>> | null,
  limit: number
): Promise<
  { bytes: Uint8Array<ArrayBuffer> } | { error: "tooLarge" | "tooManyChunks" }
> {
  if (!body) {
    return { bytes: new Uint8Array() };
  }
  const reader = body.getReader();
  let buffer = new Uint8Array(Math.min(limit, INITIAL_BODY_BUFFER));
  let size = 0;
  for (let chunks = 0; ; chunks += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: a stream's chunks can only be read one after another.
    const { done, value } = await reader.read();
    if (done) {
      return { bytes: buffer.subarray(0, size) };
    }
    const total = size + value.byteLength;
    if (total > limit || chunks === MAX_BODY_CHUNKS) {
      await reader.cancel();
      return { error: total > limit ? "tooLarge" : "tooManyChunks" };
    }
    if (total > buffer.length) {
      const grown = new Uint8Array(
        Math.min(limit, Math.max(buffer.length * 2, total))
      );
      grown.set(buffer.subarray(0, size));
      buffer = grown;
    }
    buffer.set(value, size);
    size = total;
  }
}

/**
 * Store `file` and show it as the step's image. The file is deleted again if the step can't take
 * it, so a failed upload leaves nothing behind.
 */
async function storeStepImage(
  ctx: ActionCtx,
  file: Blob,
  image: { height: number; stepId: Id<"gameSteps">; width: number }
) {
  const storageId = await ctx.storage.store(file);
  try {
    await ctx.runMutation(internal.steps.attachImage, { ...image, storageId });
  } catch (error) {
    await ctx.storage.delete(storageId);
    throw error;
  }
}

/**
 * Upload a step's image: the file is the request body, sent with the user's Convex Auth token,
 * and `stepId`, `width` and `height` are query parameters. The file is stored here, rather than
 * through an upload URL, so it is checked (size in bytes and pixels, and a PNG, JPEG, GIF, WebP
 * or AVIF signature) before it is kept, and no file is ever stored that no step shows.
 */
http.route({
  handler: httpAction(async (ctx, req) => {
    const origin = req.headers.get("origin");
    const respond = (payload: unknown, status: number) =>
      jsonResponse(origin, payload, status, UPLOAD_HEADERS);
    const error = (message: string, status: number) =>
      respond({ error: message }, status);

    if (!(await getAuthUserId(ctx))) {
      return error("Unauthorized", 401);
    }
    const params = new URL(req.url).searchParams;
    const width = parseDimension(params.get("width"));
    const height = parseDimension(params.get("height"));
    if (width === null || height === null) {
      return error("Invalid image size", 400);
    }
    if (Number(req.headers.get("content-length")) > MAX_IMAGE_BYTES) {
      return error("Image too large", 413);
    }

    let stepId: Id<"gameSteps">;
    try {
      stepId = await ctx.runMutation(internal.steps.prepareImageUpload, {
        stepId: params.get("stepId") ?? "",
      });
    } catch (prepareError) {
      return error("Upload refused", imageErrorStatus(prepareError));
    }

    // Counted as it arrives: a body sent without a Content-Length, or with
    // a false one, is cut off at the limit too.
    const body = await readBody(req.body, MAX_IMAGE_BYTES);
    if ("error" in body) {
      return body.error === "tooLarge"
        ? error("Image too large", 413)
        : error("Upload sent in too many chunks", 400);
    }
    const { bytes } = body;
    const type = sniffImageType(bytes);
    // The size comes from the file itself, so a huge image can't pass as a
    // small one.
    const stored = type ? readImageSize(bytes, type) : null;
    if (!(type && stored && stored.width > 0 && stored.height > 0)) {
      return error("Unsupported image type", 415);
    }
    if (Math.max(stored.width, stored.height) > MAX_IMAGE_DIMENSION) {
      return error("Image too large", 413);
    }
    if (!matchesStoredSize({ height, width }, stored)) {
      return error("Invalid image size", 400);
    }

    try {
      // Stored with the type its bytes show, not the one it was sent with.
      await storeStepImage(ctx, new Blob([bytes], { type }), {
        height,
        stepId,
        width,
      });
    } catch (storeError) {
      return error("Upload refused", imageErrorStatus(storeError));
    }
    return respond({ ok: true }, 200);
  }),
  method: "POST",
  path: "/step-image",
});

http.route({
  handler: preflight(UPLOAD_HEADERS),
  method: "OPTIONS",
  path: "/step-image",
});

export default http;
