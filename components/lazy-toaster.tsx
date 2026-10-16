"use client";

import { lazy, Suspense, useSyncExternalStore } from "react";

// Sonner and its icons are ~14 KB of gzipped JavaScript. On a page whose
// toasts only ever answer something the visitor did (the landing page's join
// form), the container is fetched on the first interaction instead of with the
// page. Toasts created before it mounts aren't lost: Sonner replays the ones
// still active when the container subscribes.
const Toaster = lazy(() =>
  import("@/components/ui/sonner").then((mod) => ({ default: mod.Toaster }))
);

const INTERACTIONS = ["pointerdown", "keydown", "focusin"] as const;
let interacted = false;

function subscribeToInteraction(onChange: () => void) {
  const handle = () => {
    interacted = true;
    onChange();
  };
  for (const type of INTERACTIONS) {
    window.addEventListener(type, handle, { capture: true, passive: true });
  }
  return () => {
    for (const type of INTERACTIONS) {
      window.removeEventListener(type, handle, { capture: true });
    }
  };
}

const hasInteracted = () => interacted;
const hasInteractedOnServer = () => false;

/** Sonner's toast container, mounted once the visitor first interacts with the page. */
export function LazyToaster() {
  const show = useSyncExternalStore(
    subscribeToInteraction,
    hasInteracted,
    hasInteractedOnServer
  );

  return show ? (
    <Suspense fallback={null}>
      <Toaster position="top-right" richColors />
    </Suspense>
  ) : null;
}
