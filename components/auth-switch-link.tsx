"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { Link } from "@/i18n/routing";
import { withAuthRedirect } from "@/lib/auth-redirect";

/** The URL's search string doesn't change while the page is open. */
function subscribe(): () => void {
  return () => undefined;
}

interface Props {
  children: ReactNode;
  className?: string;
  href: "/sign-in" | "/sign-up";
}

/**
 * Link between the sign-in and sign-up pages that keeps the page's `next` path, so switching
 * pages still leads back where the user started. Reads the URL in the browser, which keeps the
 * pages static.
 */
export function AuthSwitchLink({ children, className, href }: Props) {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => ""
  );
  return (
    <Link className={className} href={withAuthRedirect(href, search)}>
      {children}
    </Link>
  );
}
