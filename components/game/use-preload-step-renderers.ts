"use client";

import { useEffect } from "react";
import { preloadHighlighter } from "./highlight-client";

// Module-level so the React Compiler, which can't compile import()
// expressions, still optimizes the hook.
function preloadMarkdown(): Promise<void> {
  return import("@/components/game/markdown-viewer").then(
    () => undefined,
    () => {
      // The step loads it again when it renders.
    }
  );
}

/**
 * Download the theory-step renderers (Markdown, and the highlighter with the grammars for
 * `codeLanguages`) in the background once there is a session to show. A step's content then
 * renders as soon as it arrives instead of waiting for these chunks, which on a slow network take
 * several seconds.
 */
export function usePreloadStepRenderers(codeLanguages: string[] | undefined) {
  const languages = codeLanguages?.join(",");

  useEffect(() => {
    if (languages === undefined) {
      return;
    }
    // The highlighter only after the Markdown renderer: on a slow connection
    // they would share the bandwidth and delay the step's text, while code
    // reads fine as plain text until it is highlighted.
    preloadMarkdown().then(() => {
      if (languages === "") {
        return;
      }
      for (const language of languages.split(",")) {
        preloadHighlighter(language);
      }
    });
  }, [languages]);
}
