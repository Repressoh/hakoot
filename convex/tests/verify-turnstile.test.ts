/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://dev.hakoot.albertocaserta.it",
  "https://hakoot-dev.albertocaserta.it",
  "https://hakoot.albertocaserta.it",
];
const SITEVERIFY_URL = "https://challenges.cloudflare.com/";

/** Replace Cloudflare's siteverify endpoint with `respond`; returns the form
 * bodies it received. */
function mockSiteverify(respond: () => Response): FormData[] {
  const realFetch = globalThis.fetch;
  const received: FormData[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith(SITEVERIFY_URL)) {
      received.push(init?.body as FormData);
      return Promise.resolve(respond());
    }
    return realFetch(input, init);
  });
  return received;
}

/** POST `body` to /verify-turnstile as if sent from `origin`. */
function postToken(body: string, origin: string) {
  const t = convexTest(schema, modules);
  return t.fetch("/verify-turnstile", {
    body,
    headers: { "Content-Type": "application/json", Origin: origin },
    method: "POST",
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("/verify-turnstile preflight", () => {
  test.each(ALLOWED_ORIGINS)("allows %s", async (origin) => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/verify-turnstile", {
      headers: { Origin: origin },
      method: "OPTIONS",
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type"
    );
  });

  test("does not allow unknown sites", async () => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/verify-turnstile", {
      headers: { Origin: "https://evil.example" },
      method: "OPTIONS",
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("/verify-turnstile POST", () => {
  test("rejects a body that isn't JSON with 400", async () => {
    const res = await postToken("not json", ALLOWED_ORIGINS[0]);

    expect(res.status).toBe(400);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      ALLOWED_ORIGINS[0]
    );
    expect(await res.json()).toEqual({
      error: "Token is required",
      success: false,
    });
  });

  test("rejects a non-string token with 400", async () => {
    const res = await postToken(
      JSON.stringify({ token: 123 }),
      ALLOWED_ORIGINS[2]
    );

    expect(res.status).toBe(400);
  });

  test("returns 500 when the secret key isn't configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const res = await postToken(
      JSON.stringify({ token: "tok" }),
      ALLOWED_ORIGINS[3]
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Server configuration error",
      success: false,
    });
  });

  test("forwards the token to Cloudflare and returns its result", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const received = mockSiteverify(() => Response.json({ success: true }));

    const res = await postToken(
      JSON.stringify({ remoteip: "1.2.3.4", token: "tok" }),
      ALLOWED_ORIGINS[1]
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      ALLOWED_ORIGINS[1]
    );
    expect(await res.json()).toEqual({ success: true });
    expect(received).toHaveLength(1);
    expect(received[0]?.get("secret")).toBe("secret");
    expect(received[0]?.get("response")).toBe("tok");
    expect(received[0]?.get("remoteip")).toBe("1.2.3.4");
  });

  test("returns 500 when Cloudflare responds with an error status", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    mockSiteverify(() => new Response("bad gateway", { status: 502 }));

    const res = await postToken(
      JSON.stringify({ token: "tok" }),
      ALLOWED_ORIGINS[3]
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Verification failed",
      success: false,
    });
  });
});
