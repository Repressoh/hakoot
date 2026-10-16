/**
 * "pending": a change is waiting for the typing to pause. "saving": a save is
 * in flight. "error": the last save failed; the next change or `flush` retries.
 */
export type AutosaveStatus = "saved" | "pending" | "saving" | "error";

export interface AutosaverOptions<T> {
  /** How long the edits must pause before a save starts. */
  delayMs: number;
  /**
   * False when `initialValue` isn't stored yet, like a draft restored after a
   * failed save: it then counts as a failed save, which `flush` retries.
   */
  initialValueSaved?: boolean;
  /** The longest a change waits while edits keep coming. */
  maxWaitMs: number;
  onError: (error: unknown) => void;
  onStatusChange: (status: AutosaveStatus) => void;
  save: (value: T) => Promise<unknown>;
}

export interface Autosaver<T> {
  /** Saves pending changes now instead of waiting for the pause. */
  flush: () => void;
  hasUnsavedChanges: () => boolean;
  /** Records the latest value; values are compared by their JSON. */
  update: (value: T) => void;
  /** The latest value recorded, or the initial value. */
  value: () => T;
}

/**
 * Saves a form's value some time after it changes, one save at a time, and
 * reports whether the latest value is stored. `initialValue` counts as saved
 * unless `initialValueSaved` is false.
 */
export function createAutosaver<T>(
  initialValue: T,
  {
    delayMs,
    initialValueSaved = true,
    maxWaitMs,
    onError,
    onStatusChange,
    save,
  }: AutosaverOptions<T>
): Autosaver<T> {
  let latest = initialValue;
  let latestJson = JSON.stringify(initialValue);
  // The value of the last save started, or the initial value.
  let sentJson = latestJson;
  let failed = !initialValueSaved;
  let saving = false;
  let status: AutosaveStatus = initialValueSaved ? "saved" : "error";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingSince: number | undefined;

  function setStatus(next: AutosaveStatus) {
    if (next !== status) {
      status = next;
      onStatusChange(next);
    }
  }

  function isDirty() {
    return failed || latestJson !== sentJson;
  }

  function cancelTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  function schedule() {
    cancelTimer();
    const now = Date.now();
    pendingSince ??= now;
    timer = setTimeout(
      flush,
      Math.max(0, Math.min(delayMs, pendingSince + maxWaitMs - now))
    );
  }

  function flush() {
    cancelTimer();
    // A save that finds newer changes and no timer starts the next one.
    if (saving || !isDirty()) {
      return;
    }
    pendingSince = undefined;
    sentJson = latestJson;
    failed = false;
    saving = true;
    setStatus("saving");
    save(latest).then(
      () => {
        saving = false;
        if (!isDirty()) {
          setStatus("saved");
        } else if (timer === undefined) {
          flush();
        } else {
          setStatus("pending");
        }
      },
      (error: unknown) => {
        saving = false;
        failed = true;
        setStatus("error");
        onError(error);
        if (latestJson !== sentJson && timer === undefined) {
          flush();
        }
      }
    );
  }

  function update(value: T) {
    const json = JSON.stringify(value);
    if (json === latestJson) {
      return;
    }
    latest = value;
    latestJson = json;
    if (saving) {
      schedule();
    } else if (isDirty()) {
      if (!failed) {
        setStatus("pending");
      }
      schedule();
    } else {
      // Changed back to the stored value.
      cancelTimer();
      pendingSince = undefined;
      setStatus("saved");
    }
  }

  return {
    flush,
    hasUnsavedChanges: () => saving || isDirty(),
    update,
    value: () => latest,
  };
}
