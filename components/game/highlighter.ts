import {
  createHighlighterCore,
  type HighlighterCore,
  type LanguageInput,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubDark from "shiki/themes/github-dark.mjs";

// Shiki itself: runs in the highlight worker (highlight.worker.ts), or on the
// page if the worker can't start. Shiki is imported statically so it downloads
// with the worker's own chunks; importing it on demand added a round trip and
// highlighted code ~1-2.5s later on 2G.

// Grammars load one at a time, on demand: each is its own chunk. The language
// comes from the step's data, so it's looked up in a Map (on an object, a name
// like "constructor" or "__proto__" finds an inherited property) and what comes
// back is checked to be a function before it's called.
const LANGUAGE_LOADERS = new Map<string, () => LanguageInput>([
  ["bash", () => import("shiki/langs/bash.mjs")],
  ["css", () => import("shiki/langs/css.mjs")],
  ["go", () => import("shiki/langs/go.mjs")],
  ["html", () => import("shiki/langs/html.mjs")],
  ["java", () => import("shiki/langs/java.mjs")],
  ["javascript", () => import("shiki/langs/javascript.mjs")],
  ["json", () => import("shiki/langs/json.mjs")],
  ["markdown", () => import("shiki/langs/markdown.mjs")],
  ["python", () => import("shiki/langs/python.mjs")],
  ["rust", () => import("shiki/langs/rust.mjs")],
  ["shell", () => import("shiki/langs/shellscript.mjs")],
  ["sql", () => import("shiki/langs/sql.mjs")],
  ["typescript", () => import("shiki/langs/typescript.mjs")],
]);

const THEME = "github-dark";

let highlighterPromise: Promise<HighlighterCore> | null = null;

/**
 * One highlighter, using Shiki's JavaScript regex engine instead of the Oniguruma WebAssembly
 * build (a much larger download).
 *
 * The grammars' regular expressions are converted to ES2018 ones (`u` flag) rather than the
 * newest syntax the browser supports (`v` flag): the output is the same, but JavaScriptCore
 * (Safari's engine) compiles `v`-flag expressions far more slowly. Measured on a desktop, the first
 * TypeScript block took 690ms with `v` and 63ms with `u` there; V8 (Chrome) is about the same
 * either way (122ms vs 132ms).
 */
function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine({ forgiving: true, target: "ES2018" }),
    themes: [githubDark],
  });
  return highlighterPromise;
}

/** Download `language`'s grammar module (if it has one) without loading it into a highlighter. */
export async function prefetchGrammar(language: string): Promise<void> {
  const loader = LANGUAGE_LOADERS.get(language);
  if (typeof loader === "function") {
    await loader();
  }
}

/** Load the highlighter and `language`'s grammar (if it has one) without highlighting anything. */
export async function loadLanguage(language: string): Promise<void> {
  const highlighter = await getHighlighter();
  const loader = LANGUAGE_LOADERS.get(language);
  if (
    typeof loader === "function" &&
    !highlighter.getLoadedLanguages().includes(language)
  ) {
    await highlighter.loadLanguage(loader());
  }
}

/** Highlight `code` as HTML, loading the highlighter and the language's grammar if needed. */
export async function highlightToHtml(
  code: string,
  language: string
): Promise<string> {
  const highlighter = await getHighlighter();
  if (!LANGUAGE_LOADERS.has(language)) {
    return highlighter.codeToHtml(code, { lang: "text", theme: THEME });
  }
  await loadLanguage(language);
  return highlighter.codeToHtml(code, { lang: language, theme: THEME });
}
