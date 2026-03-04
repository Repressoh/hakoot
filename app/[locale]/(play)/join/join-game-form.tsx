"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "@/i18n/routing";

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
  const router = useRouter();
  const [code, setCode] = useState(prefilledCode ?? "");
  const [name, setName] = useState(prefilledName ?? "");
  const [loading, setLoading] = useState(false);
  const joinSession = useMutation(api.sessions.join);
  const joinByCode = useMutation(api.sessions.joinByCode);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs once on mount with prefilled props
  useEffect(() => {
    if (prefilledSessionId && prefilledName) {
      handleJoinBySessionId(
        prefilledSessionId as Id<"gameSessions">,
        prefilledName
      );
    }
  }, []);

  async function handleJoinBySessionId(
    sessionId: Id<"gameSessions">,
    joinName: string
  ) {
    setLoading(true);
    try {
      const result = await joinSession({ sessionId, name: joinName });
      localStorage.setItem(
        `participantToken_${sessionId}`,
        result.participantToken
      );
      router.push(`/session/${sessionId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invalidCode"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await joinByCode({
        inviteCode: code.trim(),
        name: name.trim(),
      });
      localStorage.setItem(
        `participantToken_${result.sessionId}`,
        result.participantToken
      );
      router.push(`/session/${result.sessionId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invalidCode"));
    } finally {
      setLoading(false);
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
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder={t("codePlaceholder")}
        readOnly={!!prefilledSessionId && !prefilledCode}
        required
        value={code}
      />
      <Input
        aria-label={t("nameLabel")}
        className="h-12 rounded-2xl border-border bg-muted/50 text-center text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-primary/50"
        disabled={!!prefilledName && !!prefilledToken}
        id="name"
        maxLength={50}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("namePlaceholder")}
        readOnly={!!prefilledName}
        required
        value={name}
      />
      <Button
        className="glow-primary press-down h-12 w-full rounded-2xl bg-primary font-bold font-display text-base text-primary-foreground hover:brightness-110"
        disabled={loading}
        type="submit"
      >
        {loading ? t("joining") : t("joinButton")}
      </Button>
    </form>
  );
}
