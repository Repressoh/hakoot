"use client";

import { Turnstile } from "@marsidev/react-turnstile";

interface TurnstileWidgetProps {
  onError?: () => void;
  onExpire?: () => void;
  onSuccess: (token: string) => void;
}

/** Cloudflare Turnstile challenge; renders nothing if the site key is not configured. */
export function TurnstileWidget({
  onSuccess,
  onError,
  onExpire,
}: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!siteKey) {
    console.error("Turnstile site key is not configured");
    return null;
  }

  return (
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
  );
}
