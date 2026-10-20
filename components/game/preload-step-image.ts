import { useEffect } from "react";
import { preloadStepImageFile } from "./step-image-source";

/**
 * Download the encrypted image at `url`, if there is one, in the background, so it shows as soon
 * as its step does.
 */
export function usePreloadStepImage(url: string | null | undefined) {
  useEffect(() => {
    if (url) {
      preloadStepImageFile(url);
    }
  }, [url]);
}
