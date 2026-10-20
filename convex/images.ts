import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/** Largest step image accepted, in bytes. The editor shrinks bigger photos before uploading. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Largest width or height a step image can have, in pixels. */
export const MAX_IMAGE_DIMENSION = 10_000;

/**
 * Most pixels a step image can have. Shown, an image takes 4 bytes a pixel, whatever its file
 * size: a small, highly compressible file of 10,000 × 10,000 would take 400 MB on every phone
 * showing it. This is 64 MB.
 */
export const MAX_IMAGE_PIXELS = 4096 * 4096;

/** Longest alt text kept for a step image. */
export const MAX_IMAGE_ALT_LENGTH = 500;

/**
 * Bytes of a file that `isAnimatedImage` reads from its start, and `scanPngChunks` at a time:
 * enough to hold a PNG's usual metadata chunks.
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

/** An ISO base media file box: its type, and where its contents start and end. */
interface Box {
  end: number;
  start: number;
  type: string;
}

/** The boxes one after another in `bytes` from `start` to `end`, up to the first malformed one. */
function readBoxes(bytes: Uint8Array, start: number, end: number): Box[] {
  const data = view(bytes);
  const boxes: Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    const size = data.getUint32(offset);
    const type = ascii(bytes, offset + 4, offset + 8);
    let header = 8;
    let boxEnd = offset + size;
    if (size === 1) {
      // A 64-bit size follows the type.
      if (offset + 16 > end) {
        break;
      }
      header = 16;
      boxEnd = offset + Number(data.getBigUint64(offset + 8));
    } else if (size === 0) {
      // Runs to the end of what holds it.
      boxEnd = end;
    }
    if (boxEnd < offset + header || boxEnd > end) {
      break;
    }
    boxes.push({ end: boxEnd, start: offset + header, type });
    offset = boxEnd;
  }
  return boxes;
}

/** The first box of `type` among `parent`'s children, which start `skip` bytes into it (past a full box's version and flags). */
function childBox(
  bytes: Uint8Array,
  parent: Box | undefined,
  type: string,
  skip = 0
): Box | undefined {
  return parent
    ? readBoxes(bytes, parent.start + skip, parent.end).find(
        (box) => box.type === type
      )
    : undefined;
}

/** The sizes of the image spatial extents (`ispe`) properties in an AVIF's `meta` → `iprp` → `ipco` boxes. */
function avifItemSizes(bytes: Uint8Array, file: Box): ImageSize[] {
  const data = view(bytes);
  // `meta` is a full box: its children start after a version and flags.
  const meta = childBox(bytes, file, "meta");
  const ipco = childBox(bytes, childBox(bytes, meta, "iprp", 4), "ipco");
  return (ipco ? readBoxes(bytes, ipco.start, ipco.end) : [])
    .filter((box) => box.type === "ispe" && box.start + 12 <= box.end)
    .map((box) => ({
      // Version and flags, then the width and height.
      height: data.getUint32(box.start + 8),
      width: data.getUint32(box.start + 4),
    }));
}

/**
 * The frame sizes an AVIF image sequence's tracks give: in each track's header (`tkhd`), and in
 * its AV1 sample descriptions (`stsd`), either of which a browser may decode its frames at.
 */
function avifTrackSizes(bytes: Uint8Array, file: Box): ImageSize[] {
  const data = view(bytes);
  const sizes: ImageSize[] = [];
  const moov = childBox(bytes, file, "moov");
  const tracks = moov ? readBoxes(bytes, moov.start, moov.end) : [];
  for (const trak of tracks.filter((box) => box.type === "trak")) {
    const tkhd = childBox(bytes, trak, "tkhd");
    // Past its version and flags, times and IDs (64-bit ones in version 1),
    // layer, volume and matrix: the width and height, in 16.16 fixed point.
    const at = tkhd && tkhd.start + (bytes[tkhd.start] === 1 ? 88 : 76);
    if (tkhd && at !== undefined && at + 8 <= tkhd.end) {
      sizes.push({
        height: Math.ceil(data.getUint32(at + 4) / 2 ** 16),
        width: Math.ceil(data.getUint32(at) / 2 ** 16),
      });
    }
    const stbl = childBox(
      bytes,
      childBox(bytes, childBox(bytes, trak, "mdia"), "minf"),
      "stbl"
    );
    // A full box with an entry count, then the entries.
    const stsd = childBox(bytes, stbl, "stsd");
    const entries = stsd ? readBoxes(bytes, stsd.start + 8, stsd.end) : [];
    for (const entry of entries) {
      // A visual sample entry: the width and height come after 24 bytes of
      // reserved fields and its data reference.
      if (entry.type === "av01" && entry.start + 28 <= entry.end) {
        sizes.push({
          height: data.getUint16(entry.start + 26),
          width: data.getUint16(entry.start + 24),
        });
      }
    }
  }
  return sizes;
}

/**
 * An AVIF's size: the largest its boxes give, so a grid image counts at its full size rather
 * than a tile's, and an image sequence at its frames' size rather than its still image's. Read
 * from the box structure, not by looking for "ispe" anywhere: the image data could hold those
 * bytes too.
 */
function avifSize(bytes: Uint8Array): ImageSize | null {
  const file: Box = { end: bytes.length, start: 0, type: "" };
  let largest: ImageSize | null = null;
  for (const size of [
    ...avifItemSizes(bytes, file),
    ...avifTrackSizes(bytes, file),
  ]) {
    if (!largest || size.width * size.height > largest.width * largest.height) {
      largest = size;
    }
  }
  return largest;
}

/** The bytes of the color table a GIF's `flags` byte (of its screen, or of a frame) says follows. */
function gifColorTableBytes(flags: number): number {
  return bitField(flags, 7, 1) === 1 ? 3 * 2 ** (bitField(flags, 0, 3) + 1) : 0;
}

/** The offset in a GIF just past the sub-blocks that start at `offset`, each a length then data. */
function skipGifSubBlocks(bytes: Uint8Array, offset: number): number {
  let at = offset;
  while (at < bytes.length && bytes[at] !== 0) {
    at += bytes[at] + 1;
  }
  return at + 1;
}

/**
 * A GIF's size: its logical screen, grown to hold each of its frames. A browser grows the screen
 * to fit a first frame larger than it, so a tiny screen could otherwise hide a huge frame.
 */
function gifSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 13) {
    return null;
  }
  const data = view(bytes);
  let width = data.getUint16(6, true);
  let height = data.getUint16(8, true);
  let offset = 13 + gifColorTableBytes(bytes[10]);
  while (offset < bytes.length) {
    if (bytes[offset] === 0x2c) {
      // A frame: its left and top offsets, width and height, and flags.
      if (offset + 10 > bytes.length) {
        break;
      }
      width = Math.max(
        width,
        data.getUint16(offset + 1, true) + data.getUint16(offset + 5, true)
      );
      height = Math.max(
        height,
        data.getUint16(offset + 3, true) + data.getUint16(offset + 7, true)
      );
      // Its color table, its LZW code size, then its data.
      offset = skipGifSubBlocks(
        bytes,
        offset + 10 + gifColorTableBytes(bytes[offset + 9]) + 1
      );
    } else if (bytes[offset] === 0x21) {
      // An extension: its label, then its data.
      offset = skipGifSubBlocks(bytes, offset + 2);
    } else {
      // The trailer, or something no decoder reads past.
      break;
    }
  }
  return { height, width };
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
      return gifSize(bytes);
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

/**
 * Follow a PNG's chunks through `window`, the file's bytes from `start`, where a chunk begins,
 * looking for the animation control chunk that makes it an APNG, which comes before its image
 * data. Gives whether it is animated once it finds either, or else the offset in the file of the
 * first chunk whose header is past the window, to read on from.
 */
export function scanPngChunks(
  window: Uint8Array,
  start: number
): { animated: boolean } | { next: number } {
  const data = view(window);
  let offset = 0;
  while (offset + 8 <= window.length) {
    const chunk = ascii(window, offset + 4, offset + 8);
    if (chunk === "acTL") {
      return { animated: true };
    }
    if (chunk === "IDAT") {
      return { animated: false };
    }
    // Length, type, data and checksum.
    offset += 12 + data.getUint32(offset);
  }
  return { next: start + offset };
}

function animatedPngPrefix(bytes: Uint8Array): boolean {
  const scan = scanPngChunks(bytes.subarray(8), 8);
  return "animated" in scan && scan.animated;
}

/**
 * Whether the image of `type` whose first bytes are `bytes` is animated: a GIF, an APNG, a WebP
 * with its animation flag set, or an AVIF image sequence. Re-encoding one through a canvas would
 * keep only its first frame. `bytes` should hold the start of the file, up to a PNG's image data:
 * a PNG whose chunks run past them counts as still (`scanPngChunks` reads on).
 */
export function isAnimatedImage(bytes: Uint8Array, type: string): boolean {
  switch (type) {
    case "image/gif":
      return true;
    case "image/png":
      return animatedPngPrefix(bytes);
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

/** Bytes of the random IV an encrypted image starts with. */
const IV_BYTES = 12;

/** Bytes turned into characters at a time by `toBase64`, few enough to pass as arguments. */
const BASE64_CHUNK = 0x80_00;

/** `bytes` in base64. */
export function toBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(start, start + BASE64_CHUNK))
    );
  }
  return btoa(chunks.join(""));
}

/**
 * `image` encrypted with a new random AES-GCM key: the file to store, the IV followed by the
 * ciphertext, and the key, base64-encoded. Step images are stored this way so players can
 * download the next step's image before it shows without being able to see it: its key only comes
 * with the step.
 */
export async function encryptImage(
  image: Uint8Array<ArrayBuffer>
): Promise<{ file: Blob; key: string }> {
  const key = await crypto.subtle.generateKey(
    { length: 256, name: "AES-GCM" },
    true,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { iv, name: "AES-GCM" },
    key,
    image
  );
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return {
    file: new Blob([iv, ciphertext], { type: "application/octet-stream" }),
    key: toBase64(rawKey),
  };
}

/**
 * The image that `encryptImage` encrypted into `file` with `key`.
 *
 * @throws If `key` isn't the file's, or the file was altered.
 */
export async function decryptImage(
  file: ArrayBuffer,
  key: string
): Promise<ArrayBuffer> {
  const rawKey = Uint8Array.from(atob(key), (char) => char.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    "AES-GCM",
    false,
    ["decrypt"]
  );
  return await crypto.subtle.decrypt(
    { iv: new Uint8Array(file, 0, IV_BYTES), name: "AES-GCM" },
    cryptoKey,
    new Uint8Array(file, IV_BYTES)
  );
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

/**
 * The URL of the image on the step after the current one of `session`, so clients can download
 * it before that step shows: a quiz's answer clock starts 10 seconds after its step does, whether
 * or not the image has arrived by then. The file is encrypted, and its key only comes with the
 * step, so nobody sees the image early. Null once the session is finished, or if the next step
 * has no image.
 */
export async function getNextImageUrl(
  ctx: QueryCtx,
  session: Doc<"gameSessions">,
  steps: Doc<"gameSteps">[]
): Promise<string | null> {
  const image =
    session.status === "finished"
      ? undefined
      : steps[session.currentStepIndex + 1]?.image;
  return image ? await ctx.storage.getUrl(image.storageId) : null;
}

/**
 * A step's image as clients show it, with the URL of its encrypted file and the key to decrypt it;
 * null without one.
 */
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
    key: image.key,
    type: image.type,
    url,
    width: image.width,
  };
}
