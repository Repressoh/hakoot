import { decryptImage, toBase64 } from "@/convex/images";

/** A download of an encrypted step image, how to start it, and how to stop it. */
interface Download {
  /** Starts the request; it waits until something holds the image. */
  begin: () => void;
  controller: AbortController;
  file: Promise<ArrayBuffer>;
}

/** The encrypted step images being or already downloaded, by URL. */
const downloads = new Map<string, Download>();

/**
 * How many preloaders and shown images need each image, by URL. A download nothing needs any more
 * is stopped, so skipping ahead through image steps on a slow connection doesn't leave each one
 * downloading.
 */
const holds = new Map<string, number>();

/**
 * An image that failed to download or decrypt, and when to try it again, on the `performance.now()`
 * clock: a monotonic one, which changes to the wall clock can't move.
 */
export interface FailedStepImage {
  retryAt: number;
}

interface Decrypted {
  failed?: FailedStepImage;
  /** Whether it is decrypted or failed, rather than still on its way. */
  settled: boolean;
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

/**
 * The download of the encrypted file at `url`, made once however many times it is asked for. Its
 * request only goes out once something holds the image (`holdStepImageFile`): a render can ask for
 * it, and React can throw that render away, leaving nothing to stop the request.
 */
function download(url: string): Download {
  const known = downloads.get(url);
  if (known) {
    return known;
  }
  const controller = new AbortController();
  let begin = () => {
    // Replaced below, before anything can call it.
  };
  const held = new Promise<void>((resolve, reject) => {
    begin = resolve;
    controller.signal.addEventListener(
      "abort",
      () => reject(controller.signal.reason),
      { once: true }
    );
  });
  const file = held
    .then(() => fetch(url, { signal: controller.signal }))
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Step image download failed: ${response.status}`);
      }
      return response.arrayBuffer();
    });
  const pending = { begin, controller, file };
  downloads.set(url, pending);
  // Asked for again later, it is downloaded again.
  file.catch(() => forgetDownload(url, pending));
  if (holds.has(url)) {
    begin();
  }
  return pending;
}

/** Forget `pending`, the download of `url`, unless a newer one has taken its place. */
function forgetDownload(url: string, pending: Download) {
  if (downloads.get(url) === pending) {
    downloads.delete(url);
  }
}

/**
 * Stop downloading the image at `url`, and forget its decryption if that hasn't finished, so it
 * starts over if it is needed again.
 */
function abandon(url: string) {
  const pending = downloads.get(url);
  if (pending) {
    downloads.delete(url);
    pending.controller.abort();
  }
  if (decrypted.get(url)?.settled === false) {
    decrypted.delete(url);
  }
}

/**
 * Note that a preloader or a shown image needs the image at `url`, until the returned function is
 * called. Once nothing needs it, its download stops.
 */
export function holdStepImageFile(url: string): () => void {
  holds.set(url, (holds.get(url) ?? 0) + 1);
  // Asked for by a render before anything held it: its request goes out now.
  downloads.get(url)?.begin();
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const left = (holds.get(url) ?? 1) - 1;
    if (left > 0) {
      holds.set(url, left);
      return;
    }
    holds.delete(url);
    // Checked once the rest of the commit's effects have run: when the next
    // step's image becomes the current one, its preloader lets go of it just
    // before its image holds it.
    queueMicrotask(() => {
      if (!holds.has(url)) {
        abandon(url);
      }
    });
  };
}

/**
 * Start downloading the encrypted step image at `url`, so it shows as soon as its step does and
 * its key arrives. Hold it (`holdStepImageFile`) for as long as it may be shown.
 */
export function preloadStepImageFile(url: string): void {
  download(url).file.catch(() => {
    // Downloaded again when its step shows.
  });
}

/**
 * A data URL of the step image whose encrypted file is at `image.url`, once it is downloaded and
 * decrypted with `image.key`; when to try again if that fails. The same promise for the same image,
 * so it can be passed to `use`: a failed one too, so a broken image isn't fetched over and over,
 * until it is asked for again with `retryOf`, the failure it gave, once that failure's `retryAt`
 * has passed (`StepImage` asks then). Naming the failure lets every view of the image ask for the
 * same retry, and makes a memoized call (the React Compiler's) run again. A data URL rather than
 * an object URL, which would have to be revoked once no image shows it. Hold the image
 * (`holdStepImageFile`) while it is shown.
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
  const pending = download(image.url);
  const entry: Decrypted = {
    settled: false,
    source: pending.file
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
        entry.settled = true;
        // Decrypted, or to be downloaded again: the encrypted file isn't
        // needed now.
        forgetDownload(image.url, pending);
      }),
  };
  // Replaced, it becomes the newest.
  decrypted.delete(image.url);
  decrypted.set(image.url, entry);
  const [oldest] = decrypted.keys();
  if (decrypted.size > MAX_DECRYPTED && oldest !== undefined) {
    decrypted.delete(oldest);
    // Asked for by a render React threw away, and never shown: its download,
    // waiting for a hold, is stopped rather than kept.
    if (!holds.has(oldest)) {
      abandon(oldest);
    }
  }
  return entry.source;
}
