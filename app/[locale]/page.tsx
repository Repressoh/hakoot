import {
  BookOpen01Icon,
  ChampionIcon,
  FlashIcon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { JoinCard } from "./join-card";

const FEATURE_ICONS = [
  { icon: BookOpen01Icon, color: "bg-emerald-500/10 text-emerald-600" },
  { icon: SourceCodeIcon, color: "bg-blue-500/10 text-blue-600" },
  { icon: ChampionIcon, color: "bg-amber-500/10 text-amber-600" },
  { icon: FlashIcon, color: "bg-purple-500/10 text-purple-600" },
] as const;

export default async function LandingPage() {
  const t = await getTranslations();

  const features = [
    { title: t("landing.feature1Title"), desc: t("landing.feature1Desc") },
    { title: t("landing.feature2Title"), desc: t("landing.feature2Desc") },
    { title: t("landing.feature3Title"), desc: t("landing.feature3Desc") },
    { title: t("landing.feature4Title"), desc: t("landing.feature4Desc") },
  ];

  const steps = [t("landing.step1"), t("landing.step2"), t("landing.step3")];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="absolute top-0 right-0 left-0 z-50">
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <span className="font-black font-display text-white text-xl tracking-tight">
            Hakoot
          </span>
          <div className="flex items-center gap-2">
            <LocaleSwitcher variant="light" />
            <Button
              asChild
              className="rounded-full border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
              size="sm"
              variant="outline"
            >
              <Link href="/sign-in">{t("nav.hostSignIn")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative flex flex-col items-center justify-center gap-8 bg-gradient-brand-radial px-4 pt-28 pb-20">
        <div className="max-w-xl space-y-3 text-center">
          <h1 className="font-black font-display text-4xl text-white tracking-tight sm:text-5xl">
            {t("landing.heroTitle")}
          </h1>
          <p className="text-lg text-white/75">{t("landing.heroSubtitle")}</p>
        </div>

        <JoinCard />

        <p className="text-center text-sm text-white/50">
          {t("nav.hostSignIn")}?{" "}
          <Link
            className="font-medium text-white/70 underline underline-offset-4 hover:text-white/90"
            href="/sign-in"
          >
            {t("nav.signIn")}
          </Link>
        </p>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => {
              const iconData = FEATURE_ICONS[i];
              return (
                <div className="space-y-3" key={f.title}>
                  <div
                    aria-hidden="true"
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconData.color}`}
                  >
                    <HugeiconsIcon
                      icon={iconData.icon}
                      size={24}
                      strokeWidth={2}
                    />
                  </div>
                  <h3 className="font-bold font-display text-base">
                    {f.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-surface-soft px-4 py-20">
        <div className="container mx-auto max-w-3xl space-y-10 text-center">
          <h2 className="font-bold font-display text-2xl">
            {t("landing.howItWorksTitle")}
          </h2>
          <ol className="relative grid grid-cols-1 gap-8 text-left sm:grid-cols-3">
            {steps.map((step, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static 3-item list
              <li className="flex items-start gap-4" key={i}>
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary font-bold font-display text-primary-foreground text-sm"
                >
                  {i + 1}
                </span>
                <p className="pt-1.5 text-muted-foreground text-sm leading-relaxed">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-gradient-brand-radial px-4 py-20 text-center">
        <div className="container mx-auto max-w-xl space-y-5">
          <h2 className="font-bold font-display text-2xl text-white">
            {t("landing.ctaTitle")}
          </h2>
          <Button
            asChild
            className="rounded-full bg-white px-8 font-bold font-display text-foreground shadow-lg hover:bg-white/90"
            size="lg"
          >
            <Link href="/sign-up">{t("landing.ctaButton")}</Link>
          </Button>
        </div>
      </section>

      <footer className="px-4 py-6 text-center text-muted-foreground text-xs">
        Hakoot — Interactive Learning Platform
      </footer>
    </div>
  );
}
