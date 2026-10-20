import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTH_REDIRECT,
  getAuthRedirect,
  safeRedirectPath,
  withAuthRedirect,
} from "./auth-redirect";

describe("safeRedirectPath", () => {
  it.each([
    "/share/0123456789abcdef0123456789abcdef",
    "/dashboard",
    "/games/k57abc_123-x",
    "/",
  ])("keeps the app path %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "share/abc",
    "//evil.example",
    "//evil.example/share",
    "/\\evil.example",
    "/\\/evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/share/abc?next=//evil.example",
    "/share/abc#x",
    "/share/a b",
    "/share//abc",
    "/sh%2F%2Fevil.example",
    "/ünicode",
    `/${"a".repeat(200)}`,
  ])("replaces %j with the dashboard", (path) => {
    expect(safeRedirectPath(path)).toBe(DEFAULT_AUTH_REDIRECT);
  });
});

describe("getAuthRedirect", () => {
  it("reads `next` from the search string", () => {
    expect(getAuthRedirect("?next=%2Fshare%2Fabc")).toBe("/share/abc");
    expect(getAuthRedirect("?other=1&next=/games/x")).toBe("/games/x");
  });

  it("falls back to the dashboard", () => {
    expect(getAuthRedirect("")).toBe(DEFAULT_AUTH_REDIRECT);
    expect(getAuthRedirect("?next=https%3A%2F%2Fevil.example")).toBe(
      DEFAULT_AUTH_REDIRECT
    );
  });
});

describe("withAuthRedirect", () => {
  it("carries a valid `next` over", () => {
    expect(withAuthRedirect("/sign-up", "?next=/share/abc")).toBe(
      "/sign-up?next=%2Fshare%2Fabc"
    );
  });

  it("leaves the link alone without one", () => {
    expect(withAuthRedirect("/sign-in", "")).toBe("/sign-in");
    expect(withAuthRedirect("/sign-in", "?next=//evil.example")).toBe(
      "/sign-in"
    );
  });
});
