import { useEffect } from "react";
import { holdStepImageFile, preloadStepImageFile } from "./step-image-source";

/**
 * Download the encrypted image at `url`, if there is one, in the background, so it shows as soon
 * as its step does. Let go of it once `url` changes or the view goes away: if nothing shows it by
 * then, its download stops.
 */
export function usePreloadStepImage(url: string | null | undefined) {
  useEffect(() => {
    if (!url) {
      return;
    }
    const release = holdStepImageFile(url);
    preloadStepImageFile(url);
    return release;
  }, [url]);
}
