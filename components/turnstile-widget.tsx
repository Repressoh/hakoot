"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useTheme } from "next-themes";

interface TurnstileWidgetProps {
  onError?: () => void;
  onExpire?: () => void;
  onSuccess: (token: string) => void;
}

export function TurnstileWidget({
  onSuccess,
  onError,
  onExpire,
}: TurnstileWidgetProps) {
  const { resolvedTheme } = useTheme();
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
        theme: "auto",
        size: "normal",
      }}
      siteKey={siteKey}
    />
  );
}
