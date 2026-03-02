import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signInTitle") };
}

export default async function SignInPage() {
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-brand-radial p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="font-black font-display text-3xl text-white tracking-tight">
            Hakoot
          </span>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-black/10 shadow-xl">
          <div className="mb-6 space-y-1 text-center">
            <h1 className="font-bold font-display text-foreground text-xl">
              {t("signInTitle")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("signInSubtitle")}
            </p>
          </div>
          <SignInForm />
        </div>

        <p className="text-center text-sm text-white/70">
          {t("noAccount")}{" "}
          <Link
            className="font-medium text-white underline underline-offset-4 hover:text-white/90"
            href="/sign-up"
          >
            {t("signUpLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
