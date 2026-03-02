"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs once on mount with prefilled props
  useEffect(() => {
    if (prefilledSessionId && prefilledName && prefilledToken) {
      handleJoinBySessionId(prefilledSessionId, prefilledName, prefilledToken);
    }
  }, []);

  async function handleJoinBySessionId(
    sessionId: string,
    joinName: string,
    token?: string
  ) {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName, inviteToken: token }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? t("invalidCode"));
        return;
      }

      router.push(`/session/${sessionId}`);
    } catch {
      toast.error(t("invalidCode"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const upperCode = code.toUpperCase().trim();

    try {
      const codeRes = await fetch(`/api/sessions/by-code?code=${upperCode}`);
      if (!codeRes.ok) {
        toast.error(t("invalidCode"));
        setLoading(false);
        return;
      }

      const { id: sessionId } = await codeRes.json();
      await handleJoinBySessionId(sessionId, name.trim());
    } catch {
      toast.error(t("invalidCode"));
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit}>
      <Input
        aria-label={t("codeLabel")}
        autoCapitalize="characters"
        autoComplete="off"
        className="h-14 rounded-xl border-border/60 bg-muted/30 text-center font-mono text-2xl uppercase tracking-[0.25em] placeholder:text-muted-foreground/40 placeholder:tracking-widest focus-visible:ring-primary/30"
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
        className="h-12 rounded-xl border-border/60 bg-muted/30 text-center placeholder:text-muted-foreground/40 focus-visible:ring-primary/30"
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
        className="h-12 w-full rounded-xl bg-foreground font-bold font-display text-background text-base hover:bg-foreground/85"
        disabled={loading}
        type="submit"
      >
        {loading ? t("joining") : t("joinButton")}
      </Button>
    </form>
  );
}
