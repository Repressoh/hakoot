import {
  BookOpen01Icon,
  ChampionIcon,
  FlashIcon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { JoinCard } from "./join-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

const FEATURE_ICONS = [
  { icon: BookOpen01Icon, color: "text-primary" },
  { icon: SourceCodeIcon, color: "text-sky-400" },
  { icon: ChampionIcon, color: "text-accent" },
  { icon: FlashIcon, color: "text-primary" },
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
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/30">
      {/* ── Arcade Float Header ── */}
      <header className="pointer-events-none fixed top-0 right-0 left-0 z-50">
        <div className="pointer-events-auto mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link className="group press-down flex items-center gap-2" href="/">
            <span className="font-black font-display text-2xl text-foreground tracking-tight transition-all group-hover:text-glow">
              HAKOOT<span className="animate-glow-pulse text-primary">_</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <LocaleSwitcher variant="light" />
            <Button
              asChild
              className="hover:glow-border press-down rounded-full border-2 border-primary/40 bg-background/50 font-bold text-primary text-sm uppercase tracking-widest backdrop-blur-md hover:border-primary hover:bg-primary/10"
              size="sm"
              variant="outline"
            >
              <Link href="/sign-in">{t("nav.hostSignIn")} [START]</Link>
            </Button>
          </div>
        </div>
      </header>
      {/* ── CRT Hero Section ── */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center gap-12 overflow-hidden bg-background px-6 pt-32 pb-24">
        {/* Arcade Grid Overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-grid opacity-30"
        />
        {/* Subtle Scanlines effect overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[length:100%_4px] bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.1)_50%)] opacity-20"
        />

        {/* Corner Neon Glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute top-[-10%] left-[-10%] size-[50vw] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute right-[-10%] bottom-[-10%] size-[40vw] rounded-full bg-accent/15 blur-[120px]" />
        </div>

        <div className="relative z-10 mt-8 max-w-4xl space-y-6 text-center">
          <h1 className="font-display font-semibold text-6xl text-foreground uppercase tracking-tighter drop-shadow-xl sm:text-7xl lg:text-8xl">
            {t("landing.heroTitle")}
          </h1>
          <p className="mx-auto max-w-2xl font-medium text-muted-foreground text-xl leading-relaxed">
            {t("landing.heroSubtitle")}
          </p>
        </div>

        <div
          className="relative z-20 w-full animate-float"
          style={{ animationDelay: "0.2s" }}
        >
          <JoinCard />
        </div>

        <p className="relative z-10 mt-8 text-center font-mono text-muted-foreground text-sm">
          {t("landing.makeGame")}{" "}
          <Link
            className="font-bold text-accent uppercase tracking-widest transition-all hover:text-glow-accent"
            href="/sign-in"
          >
            {t("landing.authenticate")}
          </Link>
        </p>
      </section>
      {/* ── Horizontal Ticket Scroll Features ── */}
      <section className="relative overflow-hidden border-border border-t-2 bg-background px-6 py-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-50"
        />

        <div className="container mx-auto max-w-7xl">
          <h2 className="mb-16 flex items-center gap-4 font-display font-semibold text-4xl text-foreground uppercase tracking-tight">
            <span className="text-5xl text-sky-400">*</span>{" "}
            {t("landing.featuresTitle")}
          </h2>

          <div className="hide-scrollbar -mx-6 flex snap-x snap-mandatory gap-8 overflow-x-auto px-6 pb-12 lg:mx-0 lg:grid lg:snap-none lg:grid-cols-2 lg:overflow-visible lg:px-0 xl:grid-cols-4">
            {features.map((f, i) => {
              const iconData = FEATURE_ICONS[i];
              return (
                <div
                  className="group relative w-[85vw] shrink-0 snap-center sm:w-[400px] lg:w-auto"
                  key={f.title}
                >
                  {/* Arcade Ticket Shape wrapper */}
                  <div
                    className="surface-elevated group-hover:glow-border relative flex h-full flex-col gap-6 border-2 border-border/50 p-8 transition-all duration-300 group-hover:-translate-y-2 group-hover:border-primary"
                    style={{ borderRadius: "24px" }}
                  >
                    {/* Ticket "hole punch" decors */}
                    <div className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full border-2 border-border/50 bg-background transition-colors group-hover:border-primary" />
                    <div className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full border-2 border-border/50 bg-background transition-colors group-hover:border-primary" />

                    <div className="flex items-start justify-between">
                      <div
                        className={`flex size-16 items-center justify-center rounded-2xl border-2 border-border/50 bg-muted group-hover:border-primary/50 ${iconData.color}`}
                      >
                        <HugeiconsIcon
                          color="currentColor"
                          icon={iconData.icon}
                          size={32}
                          strokeWidth={2.5}
                        />
                      </div>
                      <span className="font-black font-mono text-4xl text-muted-foreground/20 transition-colors group-hover:text-primary/10">
                        0{i + 1}
                      </span>
                    </div>

                    <div>
                      <h3 className="mb-3 font-display font-semibold text-2xl text-foreground uppercase">
                        {f.title}
                      </h3>
                      <p className="font-medium text-lg text-muted-foreground leading-relaxed">
                        {f.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {/* ── Neon Pipe How It Works ── */}
      <section className="relative overflow-hidden border-border border-t-2 bg-muted/20 px-6 py-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-grid opacity-10"
        />
        <div className="container relative z-10 mx-auto max-w-5xl">
          <h2 className="mb-24 text-center font-display font-semibold text-4xl text-foreground uppercase tracking-tight">
            {t("landing.howItWorksTitle")}{" "}
            <span className="animate-pulse text-primary">_</span>
          </h2>

          <div className="relative flex flex-col items-center justify-between gap-12 sm:flex-row sm:gap-4">
            {/* The Neon Pipe (Desktop) */}
            <div
              aria-hidden="true"
              className="absolute top-[48px] right-[10%] left-[10%] hidden h-2 overflow-hidden rounded-full border-border border-y bg-muted sm:block"
            >
              <div className="absolute inset-0 w-[200%] animate-[slide_3s_linear_infinite] bg-gradient-to-r from-transparent via-primary to-transparent" />
            </div>

            {/* The Neon Pipe (Mobile) */}
            <div
              aria-hidden="true"
              className="absolute top-[10%] bottom-[10%] left-[48px] w-2 overflow-hidden rounded-full border-border border-x bg-muted sm:hidden"
            >
              <div className="absolute inset-0 h-[200%] animate-[slide-vertical_3s_linear_infinite] bg-gradient-to-b from-transparent via-primary to-transparent" />
            </div>

            {steps.map((step, i) => (
              <div
                className="relative flex w-full items-center gap-8 text-center sm:flex-1 sm:flex-col sm:gap-6"
                key={step}
              >
                <div className="hover:glow-primary group relative z-10 flex size-24 shrink-0 items-center justify-center rounded-[2rem] border-4 border-border bg-background shadow-[0_0_0_8px_var(--background)] transition-all hover:border-primary">
                  <span className="font-black font-mono text-4xl text-foreground transition-colors group-hover:text-glow group-hover:text-primary">
                    {i + 1}
                  </span>
                </div>
                <div className="surface-elevated relative w-full rounded-2xl border-2 border-border/50 p-6 text-left sm:text-center">
                  {/* Small triangular pointer from box to number */}
                  <div className="absolute top-1/2 -left-3 size-4 -translate-y-1/2 rotate-45 border-border/50 border-b-2 border-l-2 bg-surface-elevated sm:-top-3 sm:left-1/2 sm:-translate-x-1/2 sm:translate-y-0 sm:border-t-2 sm:border-r-2 sm:border-b-0" />
                  <p className="font-bold text-foreground text-lg">{step}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* ── Massive Arcade CTA Banner ── */}
      <section className="relative overflow-hidden border-border border-t-2 bg-background px-6 py-40 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-grid opacity-20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="glow-accent size-[40rem] animate-pulse rounded-full bg-accent/10 blur-[100px]" />
        </div>

        <div className="surface-raised container relative z-10 mx-auto max-w-3xl space-y-12 rounded-[3rem] border-4 border-accent/20 p-16">
          <h2 className="font-display font-semibold text-5xl text-foreground uppercase tracking-tighter drop-shadow-md sm:text-6xl">
            {t("landing.ctaTitle")}
          </h2>
          <Button
            asChild
            className="press-down h-auto rounded-[2rem] border-4 border-accent-foreground/20 bg-accent px-12 py-8 font-black font-display text-2xl text-accent-foreground uppercase tracking-wider shadow-[0_0_40px_var(--accent)] transition-all hover:-translate-y-1 hover:bg-accent hover:shadow-[0_0_60px_var(--accent)]"
          >
            <Link href="/sign-up">{t("landing.ctaButton")}</Link>
          </Button>
        </div>
      </section>
      {/* ── Monospace Footer ── */}
      <footer className="flex flex-col items-center justify-between gap-4 border-border border-t bg-background px-6 py-8 font-mono text-muted-foreground text-xs uppercase tracking-widest sm:flex-row">
        <div suppressHydrationWarning>Hakoot © {new Date().getFullYear()}</div>
        <div className="flex gap-4">
          {/* ── package.json version ── */}
          <span>
            {t("landing.version")} {process.env.npm_package_version}
          </span>
        </div>
      </footer>
    </div>
  );
}
