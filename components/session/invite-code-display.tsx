"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  code: string;
  large?: boolean;
  sessionId: string;
}

export function InviteCodeDisplay({ code, sessionId, large }: Props) {
  const t = useTranslations("session");
  const [copied, setCopied] = useState(false);

  const _joinUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/en/join?session=${sessionId}`;

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (large) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-muted-foreground text-sm">{t("inviteCode")}</p>
        <button
          aria-label={`Invite code: ${code}. Click to copy.`}
          className="cursor-pointer select-all border-none bg-transparent p-0 font-bold font-mono text-5xl text-primary tracking-[0.2em] text-glow"
          onClick={copy}
          type="button"
        >
          {code}
        </button>
        <div>
          <Button
            className="rounded-xl border-border text-foreground hover:bg-muted/50"
            onClick={copy}
            size="sm"
            variant="outline"
          >
            {copied ? t("inviteCodeCopied") : t("inviteCodeCopy")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      aria-label={`Invite code: ${code}. Click to copy.`}
      className="font-bold font-mono tracking-widest text-primary border-border hover:bg-muted/50 rounded-xl"
      onClick={copy}
      size="sm"
      variant="outline"
    >
      {copied ? "✓" : code}
    </Button>
  );
}
