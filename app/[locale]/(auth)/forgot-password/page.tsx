import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("forgotPasswordTitle") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background bg-grid p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute top-1/4 left-1/3 size-72 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 size-48 rounded-full bg-accent/6 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="font-black font-display text-3xl text-glow text-primary tracking-tight">
            Hakoot
          </span>
        </div>

        <div className="surface-raised p-8">
          <div className="mb-6 space-y-1 text-center">
            <h1 className="font-semibold font-display text-foreground text-xl">
              {t("forgotPasswordTitle")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("forgotPasswordSubtitle")}
            </p>
          </div>
          <ForgotPasswordForm />
        </div>

        <p className="text-center text-muted-foreground text-sm">
          <Link
            className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            href="/sign-in"
          >
            {t("backToSignIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
