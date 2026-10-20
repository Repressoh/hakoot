import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/** Largest step image accepted, in bytes. The editor shrinks bigger photos before uploading. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Largest width or height a step image can have, in pixels. */
export const MAX_IMAGE_DIMENSION = 10_000;

/** Longest alt text kept for a step image. */
export const MAX_IMAGE_ALT_LENGTH = 500;

/**
 * Bytes from the start of a file that `isAnimatedImage` reads: enough to reach a PNG's image
 * data past the metadata chunks before it.
 */
export const IMAGE_HEADER_BYTES = 64 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const AVIF_BRANDS = new Set(["avif", "avis"]);

/** An image's size in pixels. */
export interface ImageSize {
  height: number;
  width: number;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** The `bits`-bit field of `value` that starts `shift` bits from its lowest. */
function bitField(value: number, shift: number, bits: number): number {
  return Math.floor(value / 2 ** shift) % 2 ** bits;
}

/**
 * The brands of an ISO base media file (AVIF, HEIC…) from its `ftyp` box, major brand first;
 * empty if it doesn't start with one.
 */
function ftypBrands(bytes: Uint8Array): string[] {
  if (bytes.length < 16 || ascii(bytes, 4, 8) !== "ftyp") {
    return [];
  }
  // The box's size, then "ftyp", the major brand, its version, and the
  // compatible brands to the end of the box.
  const end = Math.min(view(bytes).getUint32(0), bytes.length);
  const brands = [ascii(bytes, 8, 12)];
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    brands.push(ascii(bytes, offset, offset + 4));
  }
  return brands;
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
  if (ftypBrands(bytes).some((brand) => AVIF_BRANDS.has(brand))) {
    return "image/avif";
  }
  return null;
}

/** Whether a JPEG marker starts a frame header (SOF0–SOF15), which holds the image's size. */
function isStartOfFrame(marker: number): boolean {
  // C4 (Huffman tables), C8 (reserved) and CC (arithmetic coding) share
  // the range.
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc
  );
}

/** A JPEG's size, from the first frame header among its segments. */
function jpegSize(bytes: Uint8Array): ImageSize | null {
  const data = view(bytes);
  let offset = 2;
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      // Fill byte before a marker.
      offset += 1;
    } else if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      // Markers without a length.
      offset += 2;
    } else if (isStartOfFrame(marker)) {
      return {
        height: data.getUint16(offset + 5),
        width: data.getUint16(offset + 7),
      };
    } else if (marker === 0xda) {
      // The image data starts, with no frame header before it.
      return null;
    } else {
      offset += 2 + data.getUint16(offset + 2);
    }
  }
  return null;
}

/** A WebP's size, from its first chunk: lossy (VP8), lossless (VP8L) or extended (VP8X). */
function webpSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 30) {
    return null;
  }
  const data = view(bytes);
  const chunk = ascii(bytes, 12, 16);
  if (chunk === "VP8 ") {
    // After the frame tag, a key frame's start code, then 14-bit sizes.
    return {
      height: bitField(data.getUint16(28, true), 0, 14),
      width: bitField(data.getUint16(26, true), 0, 14),
    };
  }
  if (chunk === "VP8L") {
    const bits = data.getUint32(21, true);
    return {
      height: bitField(bits, 14, 14) + 1,
      width: bitField(bits, 0, 14) + 1,
    };
  }
  if (chunk === "VP8X") {
    // The canvas size, minus one, in 24 bits each.
    return {
      height: bitField(data.getUint32(26, true), 8, 24) + 1,
      width: bitField(data.getUint32(23, true), 8, 24) + 1,
    };
  }
  return null;
}

/**
 * An AVIF's size: the largest of its `ispe` (image spatial extents) properties, so a grid image
 * counts at its full size rather than a tile's.
 */
function avifSize(bytes: Uint8Array): ImageSize | null {
  const data = view(bytes);
  let largest: ImageSize | null = null;
  // "ispe", then the version and flags, then the width and height.
  for (let i = 4; i + 16 <= bytes.length; i += 1) {
    if (
      bytes[i] === 0x69 &&
      bytes[i + 1] === 0x73 &&
      bytes[i + 2] === 0x70 &&
      bytes[i + 3] === 0x65
    ) {
      const size = {
        height: data.getUint32(i + 12),
        width: data.getUint32(i + 8),
      };
      if (
        !largest ||
        size.width * size.height > largest.width * largest.height
      ) {
        largest = size;
      }
    }
  }
  return largest;
}

/**
 * The size, in pixels, that the image of `type` (as `sniffImageType` tells it) in `bytes` is
 * stored at, read from its header; null if the header can't be read. EXIF or AVIF rotation isn't
 * applied: a turned image shows with its sides swapped.
 */
export function readImageSize(
  bytes: Uint8Array,
  type: string
): ImageSize | null {
  const data = view(bytes);
  switch (type) {
    case "image/png":
      return bytes.length >= 24 && ascii(bytes, 12, 16) === "IHDR"
        ? { height: data.getUint32(20), width: data.getUint32(16) }
        : null;
    case "image/gif":
      return bytes.length >= 10
        ? { height: data.getUint16(8, true), width: data.getUint16(6, true) }
        : null;
    case "image/jpeg":
      return jpegSize(bytes);
    case "image/webp":
      return webpSize(bytes);
    case "image/avif":
      return avifSize(bytes);
    default:
      return null;
  }
}

/** Whether a PNG has an animation control chunk (APNG), which comes before its image data. */
function isAnimatedPng(bytes: Uint8Array): boolean {
  const data = view(bytes);
  for (let offset = 8; offset + 8 <= bytes.length; ) {
    const chunk = ascii(bytes, offset + 4, offset + 8);
    if (chunk === "acTL") {
      return true;
    }
    if (chunk === "IDAT") {
      return false;
    }
    // Length, type, data and checksum.
    offset += 12 + data.getUint32(offset);
  }
  return false;
}

/**
 * Whether the image of `type` whose first bytes are `bytes` is animated: a GIF, an APNG, a WebP
 * with its animation flag set, or an AVIF image sequence. Re-encoding one through a canvas would
 * keep only its first frame. `bytes` should hold the start of the file, up to a PNG's image data.
 */
export function isAnimatedImage(bytes: Uint8Array, type: string): boolean {
  switch (type) {
    case "image/gif":
      return true;
    case "image/png":
      return isAnimatedPng(bytes);
    case "image/webp":
      // VP8X's flags byte: bit 1 is "animation".
      return (
        bytes.length > 20 &&
        ascii(bytes, 12, 16) === "VP8X" &&
        bitField(bytes[20], 1, 1) === 1
      );
    case "image/avif":
      return ftypBrands(bytes).includes("avis");
    default:
      return false;
  }
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
