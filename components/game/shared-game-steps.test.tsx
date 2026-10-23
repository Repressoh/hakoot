// @vitest-environment happy-dom
import type { FunctionReturnType } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SharedGameSteps } from "@/app/[locale]/(app)/share/[token]/shared-game-steps";
import type { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import messages from "@/messages/en.json";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type SharedStep = FunctionReturnType<
  typeof api.sharing.getSharedGameSteps
>["page"][number];
type Status = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

const steps: SharedStep[] = Array.from({ length: 25 }, (_, index) => ({
  _id: `step-${index}` as Id<"gameSteps">,
  choices: undefined,
  codeBlock: undefined,
  image: null,
  markdownContent: undefined,
  question: `Question ${index + 1}`,
  timeLimitSeconds: undefined,
  type: "quiz",
}));

let container: HTMLDivElement;
let root: Root;
let onLoadMore = vi.fn<() => void>();
const observers: {
  disconnect: ReturnType<typeof vi.fn>;
  notify: (isIntersecting: boolean) => void;
  observe: ReturnType<typeof vi.fn>;
  options?: IntersectionObserverInit;
}[] = [];

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit
      ) {
        observers.push({
          disconnect: this.disconnect,
          notify: (isIntersecting) =>
            callback(
              [{ isIntersecting } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver
            ),
          observe: this.observe,
          options,
        });
      }
    }
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  onLoadMore = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

/** Apply a reactive pagination update without remounting the reader or resetting its selection. */
async function render(status: Status = "CanLoadMore", count = 10) {
  await act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SharedGameSteps
          onLoadMore={onLoadMore}
          status={status}
          stepCount={steps.length}
          steps={steps.slice(0, count)}
        />
      </NextIntlClientProvider>
    );
  });
}

/** Find a translated navigation control independently of its position. */
function button(label: string) {
  const found = [...container.querySelectorAll("button")].find(
    (element) => element.textContent === label
  );
  if (!found) {
    throw new Error(`Missing button: ${label}`);
  }
  return found;
}

/** Flush state updates and pagination effects caused by a reader action. */
async function click(element: HTMLButtonElement) {
  await act(() => element.click());
}

/** Read the selected step's question without matching navigation labels. */
function selectedQuestion() {
  return container.querySelector("#shared-step-content p")?.textContent;
}

describe("shared game step pagination", () => {
  test("preloads when the last three rows enter the scrollable step strip", async () => {
    await render();
    const navigation = container.querySelector("ol");
    expect(onLoadMore).not.toHaveBeenCalled();
    expect(observers[0].options?.root).toBe(navigation);
    expect(observers[0].observe).toHaveBeenCalledTimes(3);
    expect(observers[0].observe).toHaveBeenCalledWith(navigation?.children[7]);
    expect(observers[0].observe).toHaveBeenCalledWith(navigation?.children[9]);
    observers[0].notify(false);
    expect(onLoadMore).not.toHaveBeenCalled();
    observers[0].notify(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(observers[0].disconnect).toHaveBeenCalled();

    await render("LoadingMore");
    await render("CanLoadMore", 20);
    expect(selectedQuestion()).toBe("Question 1");
    expect(observers.at(-1)?.observe).toHaveBeenCalledWith(
      navigation?.children[17]
    );
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    observers.at(-1)?.notify(true);
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  test("preloads on selection even without IntersectionObserver", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    await render();
    await click(container.querySelectorAll<HTMLButtonElement>("ol button")[6]);
    expect(selectedQuestion()).toBe("Question 7");
    expect(onLoadMore).not.toHaveBeenCalled();
    await click(button("Next"));
    expect(selectedQuestion()).toBe("Question 8");
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    await render("LoadingMore");
    await click(button("Next"));
    await click(button("Next"));
    expect(selectedQuestion()).toBe("Question 10");
    expect(button("Loading...").disabled).toBe(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    await render("CanLoadMore", 20);
    expect(selectedQuestion()).toBe("Question 10");
    expect(button("Next").disabled).toBe(false);
    await click(button("Next"));
    expect(selectedQuestion()).toBe("Question 11");
  });

  test("keeps Next and Previous available after all pages load", async () => {
    await render("Exhausted", 13);
    expect(button("Previous").disabled).toBe(true);
    await click(button("Next"));
    expect(selectedQuestion()).toBe("Question 2");
    await click(container.querySelectorAll<HTMLButtonElement>("ol button")[11]);
    expect(button("Next").disabled).toBe(false);
    await click(button("Next"));
    expect(selectedQuestion()).toBe("Question 13");
    expect(button("Next").disabled).toBe(true);
    expect(button("Previous").disabled).toBe(false);
    await click(button("Previous"));
    expect(selectedQuestion()).toBe("Question 12");
    expect(button("Next").disabled).toBe(false);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  test.each<Status>(["LoadingFirstPage", "LoadingMore", "Exhausted"])(
    "does not request a page while %s",
    async (status) => {
      await render(status, 0);
      expect(onLoadMore).not.toHaveBeenCalled();
      expect(observers).toHaveLength(0);
      expect(
        button(status === "LoadingMore" ? "Loading..." : "Next").disabled
      ).toBe(true);
    }
  );

  test("continues loading after reactive pages become empty", async () => {
    await render();
    await click(container.querySelectorAll<HTMLButtonElement>("ol button")[5]);
    expect(onLoadMore).not.toHaveBeenCalled();

    await render("CanLoadMore", 0);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(observers[0].disconnect).toHaveBeenCalled();
    await render("LoadingMore", 0);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    await render("CanLoadMore", 0);
    expect(onLoadMore).toHaveBeenCalledTimes(2);

    await render("Exhausted", 5);
    expect(selectedQuestion()).toBe("Question 1");
    expect(button("Next").disabled).toBe(false);
    await click(button("Next"));
    expect(selectedQuestion()).toBe("Question 2");
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  test("disconnects the scroll observer on unmount", async () => {
    await render();
    await act(() => root.render(null));
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });
});
