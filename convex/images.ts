import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/** Largest step image accepted, in bytes. The editor shrinks bigger photos before uploading. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Largest width or height a step image can have, in pixels. */
export const MAX_IMAGE_DIMENSION = 10_000;

/** Longest alt text kept for a step image. */
export const MAX_IMAGE_ALT_LENGTH = 500;

/** Bytes of a file `sniffImageType` needs to tell its type. */
export const IMAGE_SIGNATURE_BYTES = 64;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const AVIF_BRANDS = new Set(["avif", "avis"]);

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/** Whether an ISO base media file (`ftyp` box first) lists an AVIF brand. */
function isAvif(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || ascii(bytes, 4, 8) !== "ftyp") {
    return false;
  }
  if (AVIF_BRANDS.has(ascii(bytes, 8, 12))) {
    return true;
  }
  // The box's size, then "ftyp", the major brand, its version, and the
  // compatible brands to the end of the box.
  const boxSize = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  ).getUint32(0);
  const end = Math.min(boxSize, bytes.length);
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    if (AVIF_BRANDS.has(ascii(bytes, offset, offset + 4))) {
      return true;
    }
  }
  return false;
}

/**
 * The type of the image whose first bytes are `bytes`, read from its signature rather than the
 * type it was sent with, or null if it isn't a PNG, JPEG, GIF, WebP or AVIF image. SVG is left
 * out: it can carry scripts.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const start = ascii(bytes, 0, 6);
  if (start === "GIF87a" || start === "GIF89a") {
    return "image/gif";
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (isAvif(bytes)) {
    return "image/avif";
  }
  return null;
}

/**
 * Delete the file `storageId` unless a step still shows it. Call once the step that showed it no
 * longer does: a copied game's steps share their originals' files.
 */
export async function releaseImage(
  ctx: MutationCtx,
  storageId: Id<"_storage">
): Promise<void> {
  const stillShown = await ctx.db
    .query("gameSteps")
    .withIndex("by_image_storage_id", (q) => q.eq("image.storageId", storageId))
    .first();
  // Already gone if another step that showed it was deleted in the same
  // transaction.
  if (!stillShown && (await ctx.db.system.get("_storage", storageId))) {
    await ctx.storage.delete(storageId);
  }
}

/** A step's image as clients show it, with the URL to load it from; null without one. */
export async function getImageView(
  ctx: QueryCtx,
  image: Doc<"gameSteps">["image"]
) {
  if (!image) {
    return null;
  }
  const url = await ctx.storage.getUrl(image.storageId);
  if (!url) {
    return null;
  }
  return {
    alt: image.alt ?? "",
    height: image.height,
    url,
    width: image.width,
  };
}
