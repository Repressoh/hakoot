"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/routing";

interface Props {
  resetCode?: string;
}

export function ResetPasswordForm({ resetCode }: Props) {
  const { push } = useRouter();
  const { signIn } = useAuthActions();
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;

    try {
      await signIn("password", {
        email,
        flow: "reset",
        redirectTo: "/reset-password",
      });
      toast.success("Check your email for a password reset link.");
    } catch {
      toast.error("Could not send a reset link. Please try again.");
    }
    setLoading(false);
  }

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const newPassword = (
      form.elements.namedItem("newPassword") as HTMLInputElement
    ).value;
    const confirmPassword = (
      form.elements.namedItem("confirmPassword") as HTMLInputElement
    ).value;

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (!resetCode) {
      toast.error("This reset link is missing its verification code.");
      setLoading(false);
      return;
    }

    try {
      await signIn("password", {
        email,
        flow: "reset-verification",
        code: resetCode,
        newPassword,
      });
      toast.success("Password reset successfully.");
      push("/dashboard");
    } catch {
      toast.error("Could not reset the password. Check the link and email.");
      setLoading(false);
    }
  }

  if (resetCode) {
    return (
      <form className="space-y-4" noValidate onSubmit={handleReset}>
        <div className="space-y-1.5">
          <Label className="text-foreground/80 text-sm" htmlFor="email">
            Email
          </Label>
          <Input
            autoComplete="email"
            className="h-11 rounded-xl border-border bg-muted/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
            id="email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-foreground/80 text-sm" htmlFor="newPassword">
            New password
          </Label>
          <Input
            autoComplete="new-password"
            className="h-11 rounded-xl border-border bg-muted/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
            id="newPassword"
            minLength={8}
            name="newPassword"
            placeholder="••••••••"
            required
            type="password"
          />
        </div>
        <div className="space-y-1.5">
          <Label
            className="text-foreground/80 text-sm"
            htmlFor="confirmPassword"
          >
            Confirm new password
          </Label>
          <Input
            autoComplete="new-password"
            className="h-11 rounded-xl border-border bg-muted/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
            id="confirmPassword"
            minLength={8}
            name="confirmPassword"
            placeholder="••••••••"
            required
            type="password"
          />
        </div>
        <Button
          className="glow-primary press-down h-11 w-full rounded-xl bg-primary font-bold font-display text-primary-foreground hover:brightness-110"
          disabled={loading}
          type="submit"
        >
          {loading ? "..." : "Reset password"}
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleRequest}>
      <div className="space-y-1.5">
        <Label className="text-foreground/80 text-sm" htmlFor="email">
          Email
        </Label>
        <Input
          autoComplete="email"
          className="h-11 rounded-xl border-border bg-muted/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
          id="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </div>
      <Button
        className="glow-primary press-down h-11 w-full rounded-xl bg-primary font-bold font-display text-primary-foreground hover:brightness-110"
        disabled={loading}
        type="submit"
      >
        {loading ? "..." : "Send reset link"}
      </Button>
    </form>
  );
}
