import { decryptImage, toBase64 } from "@/convex/images";

/** The encrypted step images being or already downloaded, by URL. */
const downloads = new Map<string, Promise<ArrayBuffer>>();

/**
 * Downloads kept until their image is shown. A session preloads one at a time, so older ones,
 * replaced or never shown, are let go rather than held in memory.
 */
const MAX_DOWNLOADS = 2;

/**
 * An image that failed to download or decrypt, and when to try it again, on the `performance.now()`
 * clock: a monotonic one, which changes to the wall clock can't move.
 */
export interface FailedStepImage {
  retryAt: number;
}

interface Decrypted {
  failed?: FailedStepImage;
  source: Promise<string | FailedStepImage>;
}

/** The decrypted step images, as data URLs, by the URL of their encrypted file. */
const decrypted = new Map<string, Decrypted>();

/**
 * Decrypted images kept. A session shows one at a time, so older ones are let go as new ones
 * come, rather than held in memory for the whole game.
 */
const MAX_DECRYPTED = 4;

/** How long an image that failed to download or decrypt shows as failed before another try. */
const RETRY_AFTER_MS = 10_000;

/** Forget the oldest entries of `cache` once it holds more than `max`. */
function trim(cache: Map<string, unknown>, max: number) {
  const [oldest] = cache.keys();
  if (cache.size > max && oldest !== undefined) {
    cache.delete(oldest);
  }
}

/** The encrypted file at `url`, downloaded once however many times it is asked for. */
function download(url: string): Promise<ArrayBuffer> {
  const known = downloads.get(url);
  if (known) {
    return known;
  }
  const started = fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Step image download failed: ${response.status}`);
    }
    return response.arrayBuffer();
  });
  downloads.set(url, started);
  trim(downloads, MAX_DOWNLOADS);
  // Asked for again later, it is downloaded again.
  started.catch(() => downloads.delete(url));
  return started;
}

/**
 * Start downloading the encrypted step image at `url`, so it shows as soon as its step does and
 * its key arrives.
 */
export function preloadStepImageFile(url: string): void {
  download(url).catch(() => {
    // Downloaded again when its step shows.
  });
}

/**
 * Let go of the preloaded file at `url`, if its image isn't being shown: it was replaced, or the
 * session left. The browser's HTTP cache may still hold it.
 */
export function releaseStepImageFile(url: string): void {
  downloads.delete(url);
}

/**
 * A data URL of the step image whose encrypted file is at `image.url`, once it is downloaded and
 * decrypted with `image.key`; when to try again if that fails. The same promise for the same image,
 * so it can be passed to `use`: a failed one too, so a broken image isn't fetched over and over,
 * until it is asked for again with `retryOf`, the failure it gave, once that failure's `retryAt`
 * has passed (`StepImage` asks then). Naming the failure lets every view of the image ask for the
 * same retry, and makes a memoized call (the React Compiler's) run again. A data URL rather than
 * an object URL, which would have to be revoked once no image shows it.
 */
export function stepImageSource(
  image: {
    key: string;
    type: string;
    url: string;
  },
  retryOf?: FailedStepImage
): Promise<string | FailedStepImage> {
  const known = decrypted.get(image.url);
  if (
    known &&
    !(
      known.failed &&
      retryOf === known.failed &&
      performance.now() >= known.failed.retryAt
    )
  ) {
    return known.source;
  }
  const entry: Decrypted = {
    source: download(image.url)
      .then((encrypted) => decryptImage(encrypted, image.key))
      .then(
        (bytes) =>
          `data:${image.type};base64,${toBase64(new Uint8Array(bytes))}`
      )
      .catch(() => {
        // A new object each time, so a view waiting on it knows to wait again.
        entry.failed = { retryAt: performance.now() + RETRY_AFTER_MS };
        return entry.failed;
      })
      .finally(() => {
        // Decrypted, or to be downloaded again: the encrypted file isn't
        // needed now.
        downloads.delete(image.url);
      }),
  };
  // Replaced, it becomes the newest.
  decrypted.delete(image.url);
  decrypted.set(image.url, entry);
  trim(decrypted, MAX_DECRYPTED);
  return entry.source;
}
