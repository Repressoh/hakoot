import { preload } from "react-dom";

/**
 * Start downloading the image at `url`, if there is one, so it shows as soon as its step does.
 * Call while rendering.
 */
export function preloadStepImage(url: string | null | undefined) {
  if (url) {
    preload(url, { as: "image" });
  }
}
