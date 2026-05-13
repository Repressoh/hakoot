"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/routing";

export function ResetPasswordForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const t = useTranslations("auth");
  const { push } = useRouter();
  const { signIn } = useAuthActions();
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!turnstileToken) {
      toast.error("Please complete the security check");
      return;
    }

    setLoading(true);

    const form = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

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

      await signIn("password", {
        email,
        password,
        token,
        flow: "resetPassword",
      });

      toast.success(t("passwordResetSuccess"));
      await new Promise((resolve) => setTimeout(resolve, 500));
      push("/sign-in");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.toLowerCase().includes("expired")) {
        toast.error(t("resetTokenExpired"));
      } else {
        toast.error(t("resetPasswordFailed"));
      }
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label className="text-foreground/80 text-sm" htmlFor="password">
          {t("newPassword")}
        </Label>
        <Input
          autoComplete="new-password"
          className="h-11 rounded-xl border-border bg-muted/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
          id="password"
          minLength={8}
          name="password"
          placeholder="••••••••"
          required
          type="password"
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
        {loading ? "..." : t("resetPasswordButton")}
      </Button>
    </form>
  );
}
