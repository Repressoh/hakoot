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
      className="relative w-full max-w-md mx-auto surface-elevated transition-all duration-300 group"
      style={{ 
        borderRadius: "32px",
        boxShadow: "0 20px 0 -10px var(--border)",
      }}
    >
      <div className="absolute inset-x-8 -top-3 h-6 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative border-[4px] border-border bg-card p-10 rounded-[32px] overflow-hidden">
        {/* CRT Scanline effect inner overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] opacity-10" />
        
        {/* Screen bezel reflection */}
        <div className="pointer-events-none absolute inset-0 rounded-[28px] border-2 border-white/5" />
        
        <form className="relative z-10 space-y-8" noValidate onSubmit={handleJoin}>
          
          <div className="space-y-4">
            <label htmlFor="join-code" className="block text-center font-mono text-sm tracking-widest text-primary/70 uppercase">
              {t("insertCode")}
            </label>
            <div className="relative">
              <Input
                aria-label={t("joinCodeLabel")}
                autoCapitalize="characters"
                autoComplete="off"
                className="h-24 w-full rounded-2xl border-4 border-border bg-background text-center font-mono text-5xl uppercase tracking-[0.4em] text-primary text-glow placeholder:text-muted/30 placeholder:tracking-[0.4em] focus-visible:ring-0 focus-visible:border-primary focus-visible:glow-border transition-all shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)]"
                id="join-code"
                maxLength={8}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={"000000"}
                required
                value={code}
              />
              <div aria-hidden className="absolute -bottom-2 -right-2 w-4 h-4 border-b-4 border-r-4 border-primary/20" />
              <div aria-hidden className="absolute -top-2 -left-2 w-4 h-4 border-t-4 border-l-4 border-primary/20" />
            </div>
          </div>

          <div className="space-y-4">
            <label htmlFor="join-name" className="block text-center font-mono text-xs tracking-widest text-muted-foreground uppercase">
              {t("playerTag")}
            </label>
            <Input
              aria-label={t("joinNameLabel")}
              className="h-16 w-full rounded-2xl border-2 border-border bg-background text-center text-foreground font-bold text-xl placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:border-primary/50 shadow-[inset_0_2px_5px_rgba(0,0,0,0.2)]"
              id="join-name"
              maxLength={50}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("joinNamePlaceholder")}
              required
              value={name}
            />
          </div>

          <Button
            className="group/btn relative h-20 w-full rounded-2xl bg-primary text-primary-foreground text-2xl font-black font-display uppercase tracking-widest overflow-hidden transition-all hover:bg-primary border-b-[6px] border-primary-foreground/30 active:border-b-0 active:translate-y-[6px]"
            disabled={loading || !code || !name}
            type="submit"
            style={{ 
              boxShadow: "0 0 20px var(--glow-primary), inset 0 2px 0 rgba(255,255,255,0.2)"
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-4">
              {loading ? t("connecting") : t("enterMatch")}
              {!loading && (
                <span className="text-primary-foreground/50 text-3xl transition-transform group-hover/btn:translate-x-2">»</span>
              )}
            </span>
          </Button>

        </form>
      </div>
    </section>
  );
}
