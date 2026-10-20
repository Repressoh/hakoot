import { useEffect } from "react";
import {
  preloadStepImageFile,
  releaseStepImageFile,
} from "./step-image-source";

/**
 * Download the encrypted image at `url`, if there is one, in the background, so it shows as soon
 * as its step does. Let go of it once `url` changes or the view goes away; by then it is either
 * shown, and held by the image, or not needed.
 */
export function usePreloadStepImage(url: string | null | undefined) {
  useEffect(() => {
    if (!url) {
      return;
    }
    preloadStepImageFile(url);
    return () => releaseStepImageFile(url);
  }, [url]);
}
