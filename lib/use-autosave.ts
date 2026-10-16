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
 * Saves `value` with `save` shortly after it changes, so a form needs no save
 * button. The value on the first render counts as saved. Pending changes are
 * saved right away when the component unmounts or the tab is hidden, and
 * closing the tab before they are stored asks for confirmation.
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<unknown>,
  onError: (error: unknown) => void
): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>("saved");
  const [initialValue] = useState(value);
  const autosaver = useRef<Autosaver<T> | null>(null);
  const persist = useEffectEvent((latest: T) => save(latest));
  const reportError = useEffectEvent((error: unknown) => onError(error));

  useEffect(() => {
    const current = createAutosaver(initialValue, {
      delayMs: AUTOSAVE_DELAY_MS,
      maxWaitMs: AUTOSAVE_MAX_WAIT_MS,
      onError: (error) => reportError(error),
      onStatusChange: setStatus,
      save: (latest) => persist(latest),
    });
    autosaver.current = current;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        current.flush();
      }
    }
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (current.hasUnsavedChanges()) {
        current.flush();
        event.preventDefault();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      current.flush();
    };
  }, [initialValue]);

  useEffect(() => {
    autosaver.current?.update(value);
  }, [value]);

  return status;
}
