"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const { signIn } = useAuthActions();
  const [loading, setLoading] = useState(false);
  const sentRef = useRef(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!turnstileToken) {
      toast.error("Please complete the security check");
      return;
    }

    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;

    try {
      const verifyResponse = await fetch(
        `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/verify-turnstile`,
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

      await signIn("password", { email, flow: "resetPassword" });
      sentRef.current = true;
      toast.success(t("resetEmailSent"));
    } catch {
      toast.error(t("resetEmailFailed"));
      setLoading(false);
    }
  }

  if (sentRef.current) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-foreground text-sm">{t("checkEmailForReset")}</p>
      </div>
    );
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label className="text-foreground/80 text-sm" htmlFor="email">
          {t("email")}
        </Label>
        <Input
          autoComplete="email"
          className="h-11 rounded-xl border-border bg-muted/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
          id="email"
          name="email"
          placeholder={t("emailPlaceholder")}
          required
          type="email"
        />
      </div>
      <div className="flex justify-center">
        <TurnstileWidget
          onError={() => {
            setTurnstileToken(null);
            toast.error("Security check failed");
          }}
          onExpire={() => setTurnstileToken(null)}
          onSuccess={(token) => setTurnstileToken(token)}
        />
      </div>
      <Button
        className="glow-primary press-down h-11 w-full rounded-xl bg-primary font-bold font-display text-primary-foreground hover:brightness-110"
        disabled={loading || !turnstileToken}
        type="submit"
      >
        {loading ? "..." : t("sendResetLink")}
      </Button>
    </form>
  );
}
