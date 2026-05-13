"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Link, useRouter } from "@/i18n/routing";

export function SignInForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const { push } = useRouter();
  const { signIn } = useAuthActions();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

      await signIn("password", { email, password, flow: "signIn" });
      await new Promise((resolve) => setTimeout(resolve, 500));
      push("/dashboard");
    } catch {
      toast.error(t("invalidCredentials"));
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await signIn("google", { redirectTo: "/dashboard" });
    } catch (err) {
      console.error("[Google sign-in] error:", err);
      toast.error("Google sign-in failed");
      setGoogleLoading(false);
    }
  }

  return (
    <div className="space-y-4">
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
        <div className="space-y-1.5">
          <Label className="text-foreground/80 text-sm" htmlFor="password">
            {t("password")}
          </Label>
          <Input
            autoComplete="current-password"
            className="h-11 rounded-xl border-border bg-muted/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
            id="password"
            name="password"
            placeholder={t("passwordPlaceholder")}
            required
            type="password"
          />
          <div className="flex justify-end">
            <Link
              className="text-muted-foreground text-xs underline underline-offset-2 hover:text-primary"
              href="/forgot-password"
            >
              {t("forgotPassword")}
            </Link>
          </div>
        </div>
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
        <Button
          className="glow-primary press-down h-11 w-full rounded-xl bg-primary font-bold font-display text-primary-foreground hover:brightness-110"
          disabled={loading || !turnstileToken}
          type="submit"
        >
          {loading ? "..." : t("signInButton")}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1 bg-border" />
        <span className="font-mono text-muted-foreground text-xs">
          {tc("or")}
        </span>
        <Separator className="flex-1 bg-border" />
      </div>

      <Button
        className="press-down h-11 w-full gap-2 rounded-xl border-border bg-transparent text-foreground hover:bg-muted/50"
        disabled={googleLoading}
        onClick={handleGoogle}
        type="button"
        variant="outline"
      >
        <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {t("continueWithGoogle")}
      </Button>
    </div>
  );
}
