"use client";

import { useSyncExternalStore } from "react";

/**
 * Host tokens: a session started from a game's share link has no signed-in host, so whoever
 * started it proves it with the token the server returned, kept in this browser.
 */
function storageKey(sessionId: string): string {
  return `hostToken_${sessionId}`;
}

/** Remember the host token for `sessionId` in this browser. */
export function saveHostToken(sessionId: string, hostToken: string): void {
  localStorage.setItem(storageKey(sessionId), hostToken);
}

function subscribe(onStoreChange: () => void): () => void {
  // Fires when another tab changes localStorage.
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

/**
 * The host token saved for `sessionId`: `null` if there is none (the session is the signed-in
 * user's own), `undefined` until it has been read (on the server and while hydrating).
 */
export function useHostToken(sessionId: string): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(storageKey(sessionId)),
    () => undefined
  );
}
