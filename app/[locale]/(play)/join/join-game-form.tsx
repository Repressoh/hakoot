"use client";

import { useMutation } from "convex/react";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { verifyTurnstileToken } from "@/lib/turnstile";

interface Props {
  prefilledCode?: string;
  prefilledName?: string;
  prefilledSessionId?: string;
  prefilledToken?: string;
}

export function JoinGameForm({
  prefilledSessionId,
  prefilledName,
  prefilledToken,
  prefilledCode,
}: Props) {
  const t = useTranslations("join");
  const [state, setState] = useState({
    code: prefilledCode ?? "",
    loading: !!(prefilledSessionId && prefilledName),
    name: prefilledName ?? "",
    redirectUrl: null as string | null,
    turnstileToken: null as string | null,
  });
  const joinSession = useMutation(api.sessions.join);
  const joinByCode = useMutation(api.sessions.joinByCode);
  const autoJoinStarted = useRef<boolean>(false);

  // Auto-join once when prefilled props are provided.
  // loading is pre-initialized to true in this case so no setState fires synchronously.
  useEffect(() => {
    if (autoJoinStarted.current || !(prefilledSessionId && prefilledName)) {
      return;
    }
    autoJoinStarted.current = true;
    const sessionId = prefilledSessionId as Id<"gameSessions">;
    const joinName = prefilledName;
    joinSession({ name: joinName, sessionId })
      .then((result) => {
        localStorage.setItem(
          `participantToken_${sessionId}`,
          result.participantToken
        );
        setState((prev) => ({ ...prev, redirectUrl: `/session/${sessionId}` }));
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : t("invalidCode"));
        setState((prev) => ({ ...prev, loading: false }));
      });
  }, [joinSession, prefilledName, prefilledSessionId, t]);

  if (state.redirectUrl) {
    redirect(state.redirectUrl);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!state.turnstileToken) {
      toast.error("Please complete the security check");
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));
    try {
      const verified = await verifyTurnstileToken(state.turnstileToken);

      if (!verified) {
        toast.error("Security check failed. Please try again.");
        setState((prev) => ({ ...prev, loading: false, turnstileToken: null }));
        return;
      }

      const result = await joinByCode({
        inviteCode: state.code.trim(),
        name: state.name.trim(),
      });
      localStorage.setItem(
        `participantToken_${result.sessionId}`,
        result.participantToken
      );
      setState((prev) => ({
        ...prev,
        loading: false,
        redirectUrl: `/session/${result.sessionId}`,
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invalidCode"));
      setState((prev) => ({ ...prev, loading: false }));
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <Input
        aria-label={t("codeLabel")}
        autoCapitalize="characters"
        autoComplete="off"
        className="h-14 rounded-2xl border-border bg-muted/50 text-center font-mono text-2xl text-foreground uppercase tracking-[0.3em] placeholder:text-muted-foreground/40 placeholder:tracking-widest focus-visible:ring-primary/50"
        disabled={!!prefilledSessionId && !prefilledCode}
        id="code"
        maxLength={8}
        onChange={(e) =>
          setState((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
        }
        placeholder={t("codePlaceholder")}
        readOnly={!!prefilledSessionId && !prefilledCode}
        required
        value={state.code}
      />
      <Input
        aria-label={t("nameLabel")}
        className="h-12 rounded-2xl border-border bg-muted/50 text-center text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-primary/50"
        disabled={!!prefilledName && !!prefilledToken}
        id="name"
        maxLength={50}
        onChange={(e) =>
          setState((prev) => ({ ...prev, name: e.target.value }))
        }
        placeholder={t("namePlaceholder")}
        readOnly={!!prefilledName}
        required
        value={state.name}
      />
      <div className="flex justify-center">
        <TurnstileWidget
          onError={() => {
            setState((prev) => ({ ...prev, turnstileToken: null }));
            toast.error("Security check failed");
          }}
          onExpire={() => {
            setState((prev) => ({ ...prev, turnstileToken: null }));
          }}
          onSuccess={(token) =>
            setState((prev) => ({ ...prev, turnstileToken: token }))
          }
        />
      </div>
      <Button
        className="glow-primary press-down h-12 w-full rounded-2xl bg-primary font-bold font-display text-base text-primary-foreground hover:brightness-110"
        disabled={state.loading || !state.turnstileToken}
        type="submit"
      >
        {state.loading ? t("joining") : t("joinButton")}
      </Button>
    </form>
  );
}
