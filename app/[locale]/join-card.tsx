"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/routing";

export function JoinCard() {
  const t = useTranslations("landing");
  const tj = useTranslations("join");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const upperCode = code.toUpperCase().trim();
      const codeRes = await fetch(`/api/sessions/by-code?code=${upperCode}`);

      if (!codeRes.ok) {
        toast.error(tj("invalidCode"));
        return;
      }

      const { id: sessionId } = await codeRes.json();

      const joinRes = await fetch(`/api/sessions/${sessionId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!joinRes.ok) {
        const data = await joinRes.json();
        toast.error(data.error ?? tj("invalidCode"));
        return;
      }

      router.push(`/session/${sessionId}`);
    } catch {
      toast.error(tj("invalidCode"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-label="Join a game"
      className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-black/10 shadow-xl"
    >
      <form className="space-y-4" noValidate onSubmit={handleJoin}>
        <Input
          aria-label={t("joinCodeLabel")}
          autoCapitalize="characters"
          autoComplete="off"
          className="h-14 rounded-xl border-border/60 bg-muted/30 text-center font-mono text-2xl uppercase tracking-[0.25em] placeholder:text-muted-foreground/40 placeholder:tracking-widest focus-visible:ring-primary/30"
          id="join-code"
          maxLength={8}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t("joinCodePlaceholder")}
          required
          value={code}
        />
        <Input
          aria-label={t("joinNameLabel")}
          className="h-12 rounded-xl border-border/60 bg-muted/30 text-center placeholder:text-muted-foreground/40 focus-visible:ring-primary/30"
          id="join-name"
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("joinNamePlaceholder")}
          required
          value={name}
        />
        <Button
          className="h-12 w-full rounded-xl bg-foreground font-bold font-display text-background text-base hover:bg-foreground/85"
          disabled={loading || !code || !name}
          type="submit"
        >
          {loading ? "..." : t("joinButton")}
        </Button>
      </form>
    </section>
  );
}
