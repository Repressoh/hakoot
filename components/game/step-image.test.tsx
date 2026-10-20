// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { encryptImage } from "@/convex/images";
import { StepImage } from "./step-image";

// React only flushes Suspense retries inside act() when told it runs in tests.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

/** Mount `<StepImage>` for the encrypted file at `url`. */
async function mount(url: string, key: string) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => {
    root.render(
      <StepImage
        image={{
          alt: "A cat",
          height: 300,
          key,
          type: "image/png",
          url,
          width: 400,
        }}
      />
    );
  });
  return { container, root };
}

/** Let React work until `check` passes: on a busy runner, a download and its decryption take a while. */
async function until(check: () => void) {
  await vi.waitFor(
    async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      check();
    },
    { timeout: 5000 }
  );
}

describe("StepImage", () => {
  test("shows the image decrypted from its file", async () => {
    const { file, key } = await encryptImage(PNG);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(file))
    );

    const { container, root } = await mount("https://x.test/shown", key);
    await until(() => expect(container.querySelector("img")).not.toBe(null));
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("A cat");
    expect(img?.getAttribute("src")).toBe(
      `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`
    );
    act(() => root.unmount());
  });

  test("shows a box for an image that fails, without fetching it again and again", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetch);

    const { container, root } = await mount("https://x.test/broken", "AAAA");
    await until(() =>
      expect(container.querySelector("[role=img]")).not.toBe(null)
    );
    // Well short of the next try, ten seconds on.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(container.querySelector("img")).toBe(null);
    expect(
      container.querySelector("[role=img]")?.getAttribute("aria-label")
    ).toBe("A cat");
    act(() => root.unmount());
  });

  test("tries a failed image again on its own once the network is back", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "performance"],
    });
    const { file, key } = await encryptImage(PNG);
    // Down for the first try, back for the next.
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(file));
    vi.stubGlobal("fetch", fetch);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const image = {
      alt: "A dog",
      height: 300,
      key,
      type: "image/png",
      url: "https://x.test/flaky",
      width: 400,
    };
    await act(async () => {
      root.render(<StepImage image={image} />);
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(container.querySelector("img")).toBe(null);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Nothing else renders it again: the view just sits there.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("A dog");
    act(() => root.unmount());
  });

  test("a view mounted after another failed still tries again", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "performance"],
    });
    const { file, key } = await encryptImage(PNG);
    // Down for the first two tries, back for the next.
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(file));
    vi.stubGlobal("fetch", fetch);
    const image = {
      alt: "A fox",
      height: 300,
      key,
      type: "image/png",
      url: "https://x.test/remounted",
      width: 400,
    };
    const show = async () => {
      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(<StepImage image={image} />);
        await vi.advanceTimersByTimeAsync(100);
      });
      return { container, root };
    };
    const wait = (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });

    // The first view fails, tries again and fails again, then goes away.
    const first = await show();
    await wait(10_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    act(() => first.root.unmount());

    // A new view gets that failure, and tries again once it is due.
    const second = await show();
    expect(second.container.querySelector("img")).toBe(null);
    await wait(10_000);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(second.container.querySelector("img")?.getAttribute("alt")).toBe(
      "A fox"
    );
    act(() => second.root.unmount());
  });
});
