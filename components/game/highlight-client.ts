import type { HighlightRequest, HighlightResponse } from "./highlight.worker";

// Highlighting runs in a web worker (highlight.worker.ts) so it never blocks
// the page. If the worker can't start, Shiki is loaded on the page instead.

// undefined: not started yet; null: unavailable, highlight on the page.
let worker: Worker | null | undefined;
let nextRequestId = 0;
const pendingRequests = new Map<
  number,
  { reject: () => void; resolve: (html: string) => void }
>();

function failPendingRequests() {
  for (const { reject } of pendingRequests.values()) {
    reject();
  }
  pendingRequests.clear();
}

function getWorker(): Worker | null {
  if (worker !== undefined) {
    return worker;
  }
  try {
    const started = new Worker(
      new URL("./highlight.worker.ts", import.meta.url),
      { type: "module" }
    );
    started.addEventListener(
      "message",
      (event: MessageEvent<HighlightResponse>) => {
        const response = event.data;
        const request = pendingRequests.get(response.id);
        pendingRequests.delete(response.id);
        if (response.ok) {
          request?.resolve(response.html);
        } else {
          request?.reject();
        }
      }
    );
    // The worker script failed to load: stop using it.
    started.addEventListener("error", () => {
      started.terminate();
      worker = null;
      failPendingRequests();
    });
    worker = started;
  } catch {
    worker = null;
  }
  return worker;
}

const warmedLanguages = new Set<string>();

/**
 * The worker downloads its chunks one after another, a round trip each (seconds on a slow
 * network). Importing the same modules here requests them all at once, and the worker then gets
 * them from the HTTP cache. They are only evaluated on the page; highlighting stays in the worker.
 * Done on preload only: it uses the bandwidth all at once, so the caller picks a moment when the
 * page isn't downloading anything more important.
 */
function warmWorkerChunks(language: string) {
  if (warmedLanguages.has(language)) {
    return;
  }
  warmedLanguages.add(language);
  import("./highlighter")
    .then(({ prefetchGrammar }) => prefetchGrammar(language))
    .catch(() => {
      // The worker downloads them itself.
    });
}

function send(request: HighlightRequest) {
  getWorker()?.postMessage(request);
}

function highlightOnPage(code: string, language: string) {
  return import("./highlighter").then(({ highlightToHtml }) =>
    highlightToHtml(code, language)
  );
}

/** Highlight `code` as HTML, in the worker if possible. */
export function highlight(code: string, language: string): Promise<string> {
  if (!getWorker()) {
    return highlightOnPage(code, language);
  }
  const id = nextRequestId;
  nextRequestId += 1;
  return new Promise<string>((resolve, reject) => {
    pendingRequests.set(id, { reject, resolve });
    send({ code, id, language, type: "highlight" });
  }).catch(() => highlightOnPage(code, language));
}

/** Start loading the highlighter and a grammar before a code block needs them. */
export function preloadHighlighter(language: string) {
  if (getWorker()) {
    warmWorkerChunks(language);
    send({ language, type: "preload" });
    return;
  }
  import("./highlighter")
    .then(({ loadLanguage }) => loadLanguage(language))
    .catch(() => {
      // Highlighting falls back to plain text when the code block renders.
    });
}
