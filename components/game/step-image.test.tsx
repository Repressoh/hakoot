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
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

/** Mount `<StepImage>` for the encrypted file at `url`, and let it settle for `ms`. */
async function mount(url: string, key: string, ms: number) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
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
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
  return { container, root };
}

describe("StepImage", () => {
  test("shows the image decrypted from its file", async () => {
    const { file, key } = await encryptImage(PNG);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(file))
    );

    const { container, root } = await mount("https://x.test/shown", key, 50);
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

    const { container, root } = await mount(
      "https://x.test/broken",
      "AAAA",
      500
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(container.querySelector("img")).toBe(null);
    expect(
      container.querySelector("[role=img]")?.getAttribute("aria-label")
    ).toBe("A cat");
    act(() => root.unmount());
  });
});
