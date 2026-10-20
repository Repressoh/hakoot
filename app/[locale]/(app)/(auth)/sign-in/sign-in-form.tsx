"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Link, useRouter } from "@/i18n/routing";
import { getAuthRedirect } from "@/lib/auth-redirect";
import { verifyTurnstileToken } from "@/lib/turnstile";

/** Host sign-in with email and password or a magic link, guarded by Turnstile. */
export function SignInForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const { push } = useRouter();
  const { signIn } = useAuthActions();
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
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
      const verified = await verifyTurnstileToken(turnstileToken);

      if (!verified) {
        toast.error("Security check failed. Please try again.");
        setTurnstileToken(null);
        setLoading(false);
        return;
      }

      await signIn("password", { email, flow: "signIn", password });
      await new Promise((resolve) => setTimeout(resolve, 500));
      push(getAuthRedirect(window.location.search));
    } catch {
      setLoading(false);
      toast.error(t("invalidCredentials"));
    }
  }

  async function handleMagicLink() {
    const emailInput = document.getElementById("email") as HTMLInputElement;
    const email = emailInput?.value.trim();

    if (!email) {
      toast.error("Enter your email address first.");
      emailInput?.focus();
      return;
    }

    setMagicLinkLoading(true);
    try {
      await signIn("email", {
        email,
        redirectTo: getAuthRedirect(window.location.search),
      });
      setMagicLinkLoading(false);
      toast.success("Check your email for a sign-in link.");
    } catch {
      setMagicLinkLoading(false);
      toast.error("Could not send a magic link. Please try again.");
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
          <div className="flex items-center justify-between gap-3">
            <Label className="text-foreground/80 text-sm" htmlFor="password">
              {t("password")}
            </Label>
            <Link
              className="font-medium text-primary text-xs underline underline-offset-4 hover:text-primary/80"
              href="/reset-password"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <Input
            autoComplete="current-password"
            className="h-11 rounded-xl border-border bg-muted/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
            id="password"
            name="password"
            placeholder={t("passwordPlaceholder")}
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
        <Button
          className="press-down h-11 w-full rounded-xl border-border bg-transparent text-foreground hover:bg-muted/50"
          disabled={magicLinkLoading}
          onClick={handleMagicLink}
          type="button"
          variant="outline"
        >
          {magicLinkLoading ? "..." : "Email me a magic link"}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1 bg-border" />
        <span className="font-mono text-muted-foreground text-xs">
          {tc("or")}
        </span>
        <Separator className="flex-1 bg-border" />
      </div>

      <GoogleSignInButton />
    </div>
  );
}
