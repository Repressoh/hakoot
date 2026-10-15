import { highlightToHtml, loadLanguage } from "./highlighter";

// Web worker that highlights code for ClientCodeBlock, so tokenizing (the
// first block of a language takes hundreds of milliseconds on a phone) doesn't
// block the page, which on the player screen is when the answer buttons
// appear.

export type HighlightRequest =
  | { code: string; id: number; language: string; type: "highlight" }
  | { language: string; type: "preload" };

export type HighlightResponse =
  | { html: string; id: number; ok: true }
  | { id: number; ok: false };

function reply(response: HighlightResponse) {
  globalThis.postMessage(response);
}

globalThis.addEventListener(
  "message",
  (event: MessageEvent<HighlightRequest>) => {
    const request = event.data;
    if (request.type === "preload") {
      loadLanguage(request.language).catch(() => {
        // Retried when a block in this language is highlighted.
      });
      return;
    }
    highlightToHtml(request.code, request.language)
      .then((html) => reply({ html, id: request.id, ok: true }))
      .catch(() => reply({ id: request.id, ok: false }));
  }
);
