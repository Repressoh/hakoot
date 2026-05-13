import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("resetPasswordTitle") };
}

export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const searchParams = await props.searchParams;

  if (!(searchParams.token && searchParams.email)) {
    const t = await getTranslations("auth");
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background bg-grid p-4">
        <div className="surface-raised w-full max-w-sm space-y-4 p-8 text-center">
          <h1 className="font-semibold font-display text-foreground text-xl">
            {t("invalidResetLink")}
          </h1>
          <p className="text-muted-foreground text-sm">
            <Link
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              href="/forgot-password"
            >
              {t("requestNewResetLink")}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const t = await getTranslations("auth");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background bg-grid p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute top-1/3 right-1/3 size-72 rounded-full bg-accent/8 blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 size-48 rounded-full bg-primary/6 blur-3xl" />
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
              {t("resetPasswordTitle")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("resetPasswordSubtitle")}
            </p>
          </div>
          <ResetPasswordForm
            email={searchParams.email}
            token={searchParams.token}
          />
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
