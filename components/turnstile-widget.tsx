"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// Turnstile's script, challenge page and proof-of-work are ~150 KB to well
// over 700 KB and start downloading as soon as the widget renders. Rendered
// with the page, they competed with its JavaScript on every visit, so the
// widget now waits until the visitor starts filling in the form; it has
// usually passed by the time they reach the submit button.
const Turnstile = dynamic(
  () => import("@marsidev/react-turnstile").then((mod) => mod.Turnstile),
  { ssr: false }
);

/** Events on the enclosing form that mean the visitor is about to use it. */
const START_EVENTS = ["focusin", "pointerdown", "keydown", "input"] as const;

interface TurnstileWidgetProps {
  onError?: () => void;
  onExpire?: () => void;
  onSuccess: (token: string) => void;
}

/** Cloudflare Turnstile challenge, loaded once the visitor starts on its form; renders nothing if the site key is not configured. */
export function TurnstileWidget({
  onSuccess,
  onError,
  onExpire,
}: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [started, setStarted] = useState(false);

  /** Starts the challenge on the first interaction with the form (or right away outside one). */
  const watchForm = (node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }
    const form = node.closest("form");
    if (!form || form.contains(document.activeElement)) {
      setStarted(true);
      return;
    }
    const start = () => setStarted(true);
    for (const type of START_EVENTS) {
      form.addEventListener(type, start, { once: true, passive: true });
    }
    return () => {
      for (const type of START_EVENTS) {
        form.removeEventListener(type, start);
      }
    };
  };

  if (!siteKey) {
    console.error("Turnstile site key is not configured");
    return null;
  }

  return (
    // The widget's own size, reserved so the form doesn't move when it appears.
    <div className="h-[65px] w-[300px]" ref={started ? undefined : watchForm}>
      {started ? (
        <Turnstile
          onError={onError}
          onExpire={onExpire}
          onSuccess={onSuccess}
          options={{
            size: "normal",
            theme: "auto",
          }}
          siteKey={siteKey}
        />
      ) : null}
    </div>
  );
}
