"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  type Autosaver,
  type AutosaveStatus,
  createAutosaver,
} from "./autosave";

const AUTOSAVE_DELAY_MS = 800;
const AUTOSAVE_MAX_WAIT_MS = 5000;

/**
 * The latest value of each editor that closed before its changes were stored,
 * by draft key. In-app navigation can't wait for the last save, so if that
 * save fails, reopening the editor restores the value and saves it again.
 */
const unsavedDrafts = new Map<string, unknown>();

/**
 * The value an editor for `draftKey` closed with before it was stored, if any. Start that
 * editor's form from it: `useAutosave` with the same key saves it again.
 */
export function getUnsavedDraft<T>(draftKey: string): T | undefined {
  return unsavedDrafts.get(draftKey) as T | undefined;
}

/**
 * Saves `value` with `save` shortly after it changes, so a form needs no save
 * button. The value on the first render counts as saved, unless it is the
 * unsaved draft for `draftKey`. Pending changes are saved right away when the
 * component unmounts or the tab is hidden, and closing the tab before they are
 * stored asks for confirmation.
 */
export function useAutosave<T>(
  draftKey: string,
  value: T,
  save: (value: T) => Promise<unknown>,
  onError: (error: unknown) => void
): AutosaveStatus {
  const [restored] = useState(() => unsavedDrafts.has(draftKey));
  const [status, setStatus] = useState<AutosaveStatus>(
    restored ? "error" : "saved"
  );
  const [initialValue] = useState(value);
  const autosaver = useRef<Autosaver<T> | null>(null);
  const persist = useEffectEvent((latest: T) => save(latest));
  const reportError = useEffectEvent((error: unknown) => onError(error));

  useEffect(() => {
    let open = true;
    let listening = false;
    const current = createAutosaver(initialValue, {
      delayMs: AUTOSAVE_DELAY_MS,
      initialValueSaved: !restored,
      maxWaitMs: AUTOSAVE_MAX_WAIT_MS,
      onError: (error) => reportError(error),
      onStatusChange: (next) => {
        listen(open && next !== "saved");
        if (open) {
          setStatus(next);
        } else if (
          next === "saved" &&
          unsavedDrafts.get(draftKey) === current.value()
        ) {
          // Stored after all, so reopening starts from the server's copy.
          unsavedDrafts.delete(draftKey);
        }
      },
      save: (latest) => persist(latest),
    });
    autosaver.current = current;
    listen(restored);
    if (restored) {
      unsavedDrafts.delete(draftKey);
      current.flush();
    }

    // Attached the moment changes are unsaved, and only then: in Firefox, a
    // beforeunload listener keeps the page out of the back/forward cache.
    function listen(unsaved: boolean) {
      if (unsaved !== listening) {
        listening = unsaved;
        if (unsaved) {
          window.addEventListener("beforeunload", handleBeforeUnload);
        } else {
          window.removeEventListener("beforeunload", handleBeforeUnload);
        }
      }
    }
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      current.flush();
      event.preventDefault();
      // Chrome and Edge before 119 only ask when returnValue is set.
      event.returnValue = true;
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        current.flush();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      open = false;
      listen(false);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (current.hasUnsavedChanges()) {
        // Kept until the save is confirmed, in case it fails.
        unsavedDrafts.set(draftKey, current.value());
        current.flush();
      }
    };
  }, [draftKey, initialValue, restored]);

  useEffect(() => {
    autosaver.current?.update(value);
  }, [value]);

  return status;
}
