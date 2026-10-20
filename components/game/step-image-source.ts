import { decryptImage, toBase64 } from "@/convex/images";

/** The encrypted step images being or already downloaded, by URL. */
const downloads = new Map<string, Promise<ArrayBuffer>>();

/** The decrypted step images, as data URLs, by the URL of their encrypted file. */
const decrypted = new Map<string, Promise<string | null>>();

/**
 * Decrypted images kept. A session shows one at a time, so older ones are let go as new ones
 * come, rather than held in memory for the whole game.
 */
const MAX_DECRYPTED = 4;

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
 * A data URL of the step image whose encrypted file is at `image.url`, once it is downloaded and
 * decrypted with `image.key`; null if that fails. The same promise for the same image, so it can
 * be passed to `use`. A data URL rather than an object URL, which would have to be revoked once
 * no image shows it.
 */
export function stepImageSource(image: {
  key: string;
  type: string;
  url: string;
}): Promise<string | null> {
  const known = decrypted.get(image.url);
  if (known) {
    return known;
  }
  const source = download(image.url)
    .then((encrypted) => decryptImage(encrypted, image.key))
    .then(
      (bytes) => `data:${image.type};base64,${toBase64(new Uint8Array(bytes))}`
    )
    .catch(() => {
      // Tried again the next time it renders.
      decrypted.delete(image.url);
      return null;
    })
    .finally(() => {
      // Decrypted, or to be downloaded again: the encrypted file isn't
      // needed now.
      downloads.delete(image.url);
    });
  decrypted.set(image.url, source);
  const [oldest] = decrypted.keys();
  if (decrypted.size > MAX_DECRYPTED && oldest !== undefined) {
    decrypted.delete(oldest);
  }
  return source;
}
