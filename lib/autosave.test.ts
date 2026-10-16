// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type AutosaveStatus, createAutosaver } from "./autosave";

const DELAY_MS = 800;
const MAX_WAIT_MS = 5000;

interface PendingSave {
  reject: (error: unknown) => void;
  resolve: () => void;
  value: string;
}

/** An autosaver whose saves stay in flight until the test settles them. */
function setup(initialValue = "a") {
  const saves: PendingSave[] = [];
  const statuses: AutosaveStatus[] = [];
  const errors: unknown[] = [];
  const autosaver = createAutosaver(initialValue, {
    delayMs: DELAY_MS,
    maxWaitMs: MAX_WAIT_MS,
    onError: (error) => errors.push(error),
    onStatusChange: (status) => statuses.push(status),
    save: (value) =>
      new Promise<void>((resolve, reject) => {
        saves.push({ reject, resolve, value });
      }),
  });
  return { autosaver, errors, saves, statuses };
}

/** Runs the `then` callbacks of a settled save. */
async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAutosaver", () => {
  test("saves the latest value once the edits pause", async () => {
    const { autosaver, saves, statuses } = setup();

    autosaver.update("ab");
    vi.advanceTimersByTime(DELAY_MS - 1);
    autosaver.update("abc");
    vi.advanceTimersByTime(DELAY_MS - 1);
    expect(saves).toEqual([]);
    expect(autosaver.hasUnsavedChanges()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(saves.map((s) => s.value)).toEqual(["abc"]);

    saves[0].resolve();
    await settle();
    expect(statuses).toEqual(["pending", "saving", "saved"]);
    expect(autosaver.hasUnsavedChanges()).toBe(false);
  });

  test("does not save the initial value, or the same value twice", async () => {
    const { autosaver, saves } = setup();

    autosaver.update("a");
    vi.advanceTimersByTime(MAX_WAIT_MS);
    expect(saves).toEqual([]);

    autosaver.update("b");
    vi.advanceTimersByTime(DELAY_MS);
    saves[0].resolve();
    await settle();
    autosaver.update("b");
    autosaver.flush();
    expect(saves).toHaveLength(1);
  });

  test("saves during continuous typing at least every maxWaitMs", () => {
    const { autosaver, saves } = setup("");

    let text = "";
    for (let elapsed = 0; elapsed < MAX_WAIT_MS; elapsed += 100) {
      text += "x";
      autosaver.update(text);
      vi.advanceTimersByTime(100);
    }

    expect(saves).toHaveLength(1);
    expect(saves[0].value.length).toBe(MAX_WAIT_MS / 100);
  });

  test("changing back to the stored value cancels the save", () => {
    const { autosaver, saves, statuses } = setup();

    autosaver.update("ab");
    autosaver.update("a");
    vi.advanceTimersByTime(MAX_WAIT_MS);

    expect(saves).toEqual([]);
    expect(statuses).toEqual(["pending", "saved"]);
    expect(autosaver.hasUnsavedChanges()).toBe(false);
  });

  test("changes made during a save are saved after it", async () => {
    const { autosaver, saves, statuses } = setup();

    autosaver.update("b");
    vi.advanceTimersByTime(DELAY_MS);
    autosaver.update("c");
    vi.advanceTimersByTime(DELAY_MS);
    // One save at a time.
    expect(saves.map((s) => s.value)).toEqual(["b"]);

    saves[0].resolve();
    await settle();
    expect(saves.map((s) => s.value)).toEqual(["b", "c"]);

    saves[1].resolve();
    await settle();
    expect(statuses).toEqual(["pending", "saving", "saved"]);
    expect(autosaver.hasUnsavedChanges()).toBe(false);
  });

  test("flush saves pending changes without waiting", async () => {
    const { autosaver, saves } = setup();

    autosaver.update("b");
    autosaver.flush();
    expect(saves.map((s) => s.value)).toEqual(["b"]);

    // Flushed mid-save, as on unmount: the newer value follows the save.
    autosaver.update("c");
    autosaver.flush();
    expect(saves).toHaveLength(1);
    saves[0].resolve();
    await settle();
    expect(saves.map((s) => s.value)).toEqual(["b", "c"]);
  });

  test("a failed save is reported and retried", async () => {
    const { autosaver, errors, saves, statuses } = setup();
    const error = new Error("offline");

    autosaver.update("b");
    vi.advanceTimersByTime(DELAY_MS);
    saves[0].reject(error);
    await settle();
    expect(errors).toEqual([error]);
    expect(statuses.at(-1)).toBe("error");
    expect(autosaver.hasUnsavedChanges()).toBe(true);

    // Nothing changed since, but the value was never stored.
    autosaver.flush();
    expect(saves.map((s) => s.value)).toEqual(["b", "b"]);
    saves[1].resolve();
    await settle();
    expect(statuses.at(-1)).toBe("saved");
  });

  test("a failed save keeps reporting the error until the retry starts", async () => {
    const { autosaver, saves, statuses } = setup();

    autosaver.update("b");
    vi.advanceTimersByTime(DELAY_MS);
    saves[0].reject(new Error("offline"));
    await settle();

    autosaver.update("c");
    expect(statuses.at(-1)).toBe("error");
    vi.advanceTimersByTime(DELAY_MS);
    expect(saves.map((s) => s.value)).toEqual(["b", "c"]);
    expect(statuses.at(-1)).toBe("saving");
  });

  test("changes made during a failed save are still saved", async () => {
    const { autosaver, saves } = setup();

    autosaver.update("b");
    vi.advanceTimersByTime(DELAY_MS);
    autosaver.update("c");
    vi.advanceTimersByTime(DELAY_MS);
    saves[0].reject(new Error("offline"));
    await settle();

    expect(saves.map((s) => s.value)).toEqual(["b", "c"]);
  });
});

describe("createAutosaver with an unsaved initial value", () => {
  test("flush stores the initial value, and nothing before", async () => {
    const saves: string[] = [];
    const statuses: AutosaveStatus[] = [];
    const autosaver = createAutosaver("draft", {
      delayMs: DELAY_MS,
      initialValueSaved: false,
      maxWaitMs: MAX_WAIT_MS,
      onError: () => undefined,
      onStatusChange: (status) => statuses.push(status),
      save: (value) => {
        saves.push(value);
        return Promise.resolve();
      },
    });

    vi.advanceTimersByTime(MAX_WAIT_MS);
    expect(saves).toEqual([]);
    expect(autosaver.hasUnsavedChanges()).toBe(true);

    autosaver.flush();
    await settle();
    expect(saves).toEqual(["draft"]);
    expect(statuses).toEqual(["saving", "saved"]);
    expect(autosaver.hasUnsavedChanges()).toBe(false);
    expect(autosaver.value()).toBe("draft");
  });
});
