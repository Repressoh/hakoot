"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/routing";

export function JoinCard() {
  const t = useTranslations("landing");
  const tj = useTranslations("join");
  const { push } = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const joinByCode = useMutation(api.sessions.joinByCode);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();

    if (!turnstileToken) {
      toast.error("Please complete the security check");
      return;
    }

    setLoading(true);
    try {
      const verifyResponse = await fetch(
        `${process.env.NEXT_PUBLIC_CONVEX_URL}/verify-turnstile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: turnstileToken }),
        }
      );

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.success) {
        toast.error("Security check failed. Please try again.");
        setTurnstileToken(null);
        setLoading(false);
        return;
      }

      const result = await joinByCode({
        inviteCode: code.trim(),
        name: name.trim(),
      });
      localStorage.setItem(
        `participantToken_${result.sessionId}`,
        result.participantToken
      );
      setLoading(false);
      push(`/session/${result.sessionId}`);
    } catch {
      toast.error(tj("invalidCode"));
      setLoading(false);
    }
  }

  return (
    <section
      aria-label="Join a game"
      className="surface-elevated group relative mx-auto w-full max-w-md transition-all duration-300"
      style={{
        borderRadius: "32px",
        boxShadow: "0 20px 0 -10px var(--border)",
      }}
    >
      <div className="absolute inset-x-8 -top-3 h-6 bg-primary/20 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />

      <div className="relative overflow-hidden rounded-[32px] border-[4px] border-border bg-card p-10">
        {/* CRT Scanline effect inner overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[length:100%_4px] bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.05)_50%)] opacity-10" />

        {/* Screen bezel reflection */}
        <div className="pointer-events-none absolute inset-0 rounded-[28px] border-2 border-white/5" />

        <form
          className="relative z-10 space-y-8"
          noValidate
          onSubmit={handleJoin}
        >
          <div className="space-y-4">
            <label
              className="block text-center font-mono text-primary/70 text-sm uppercase tracking-widest"
              htmlFor="join-code"
            >
              {t("insertCode")}
            </label>
            <div className="relative">
              <Input
                aria-label={t("joinCodeLabel")}
                autoCapitalize="characters"
                autoComplete="off"
                className="focus-visible:glow-border h-24 w-full rounded-2xl border-4 border-border bg-background text-center font-mono text-5xl text-glow text-primary uppercase tracking-[0.4em] shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] transition-all placeholder:text-muted/30 placeholder:tracking-[0.4em] focus-visible:border-primary focus-visible:ring-0"
                id="join-code"
                maxLength={8}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={"000000"}
                required
                value={code}
              />
              <div
                aria-hidden
                className="absolute -right-2 -bottom-2 size-4 border-primary/20 border-r-2 border-b-2"
              />
              <div
                aria-hidden
                className="absolute -top-2 -left-2 size-4 border-primary/20 border-t-2 border-l-2"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label
              className="block text-center font-mono text-muted-foreground text-xs uppercase tracking-widest"
              htmlFor="join-name"
            >
              {t("playerTag")}
            </label>
            <Input
              aria-label={t("joinNameLabel")}
              className="h-16 w-full rounded-2xl border-2 border-border bg-background text-center font-bold text-foreground text-xl shadow-[inset_0_2px_5px_rgba(0,0,0,0.2)] placeholder:text-muted-foreground/30 focus-visible:border-primary/50 focus-visible:ring-0"
              id="join-name"
              maxLength={50}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("joinNamePlaceholder")}
              required
              value={name}
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-center">
              <TurnstileWidget
                onError={() => {
                  setTurnstileToken(null);
                  toast.error("Security check failed");
                }}
                onExpire={() => {
                  setTurnstileToken(null);
                }}
                onSuccess={(token) => setTurnstileToken(token)}
              />
            </div>
          </div>

          <Button
            className="group/btn relative h-20 w-full overflow-hidden rounded-2xl border-primary-foreground/30 border-b-[6px] bg-primary font-black font-display text-2xl text-primary-foreground uppercase tracking-widest transition-all hover:bg-primary active:translate-y-[6px] active:border-b-0"
            disabled={loading || !code || !name || !turnstileToken}
            style={{
              boxShadow:
                "0 0 20px var(--glow-primary), inset 0 2px 0 rgba(255,255,255,0.2)",
            }}
            type="submit"
          >
            <span className="relative z-10 flex items-center justify-center gap-4">
              {loading ? t("connecting") : t("enterMatch")}
              {!loading && (
                <span className="text-3xl text-primary-foreground/50 transition-transform group-hover/btn:translate-x-2">
                  »
                </span>
              )}
            </span>
          </Button>
        </form>
      </div>
    </section>
  );
}
