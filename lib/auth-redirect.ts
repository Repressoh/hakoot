/** Where signing in or up leads when the page wasn't opened with a `next` path. */
export const DEFAULT_AUTH_REDIRECT = "/dashboard";

/** An app path: "/" and then letters, digits, "-", "_" and "/", but never "//". */
const SAFE_PATH = /^\/(?!\/)[\w/-]*$/;
const MAX_PATH_LENGTH = 200;

/**
 * `path` if it is a path within the app, otherwise the dashboard. Only plain paths are accepted,
 * so a crafted `next` can't send someone to another site ("//evil.example", "/\\evil.example",
 * "https://…") after they sign in.
 */
export function safeRedirectPath(path: string | null | undefined): string {
  if (
    typeof path === "string" &&
    path.length <= MAX_PATH_LENGTH &&
    SAFE_PATH.test(path) &&
    !path.includes("//")
  ) {
    return path;
  }
  return DEFAULT_AUTH_REDIRECT;
}

/** The sign-in or sign-up page's `next` search parameter, validated by `safeRedirectPath`. */
export function getAuthRedirect(search: string): string {
  return safeRedirectPath(new URLSearchParams(search).get("next"));
}

/** `href` (a sign-in or sign-up page) carrying `next` over from `search`, if it has a valid one. */
export function withAuthRedirect(href: string, search: string): string {
  const next = getAuthRedirect(search);
  return next === DEFAULT_AUTH_REDIRECT
    ? href
    : `${href}?${new URLSearchParams({ next })}`;
}
