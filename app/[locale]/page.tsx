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
      <header className="fixed top-0 right-0 left-0 z-50 pointer-events-none">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 pointer-events-auto">
          <Link href="/" className="group flex items-center gap-2 press-down">
            <span className="font-black font-display text-2xl tracking-tight text-foreground transition-all group-hover:text-glow">
              HAKOOT<span className="text-primary animate-glow-pulse">_</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <LocaleSwitcher variant="light" />
            <Button
              asChild
              className="rounded-full border-2 border-primary/40 bg-background/50 text-primary backdrop-blur-md hover:border-primary hover:bg-primary/10 hover:glow-border press-down text-sm font-bold tracking-widest uppercase"
              size="sm"
              variant="outline"
            >
              <Link href="/sign-in">{t("nav.hostSignIn")} [START]</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── CRT Hero Section ── */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center gap-12 px-6 pt-32 pb-24 bg-background overflow-hidden">
        {/* Arcade Grid Overlay */}
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" aria-hidden="true" />
        {/* Subtle Scanlines effect overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20" aria-hidden="true" />
        
        {/* Corner Neon Glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[40vw] w-[40vw] rounded-full bg-accent/15 blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-4xl space-y-6 text-center mt-8">
          <h1 className="font-black font-display text-6xl tracking-tighter text-foreground sm:text-7xl lg:text-8xl drop-shadow-xl uppercase">
            {t("landing.heroTitle")}
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground font-medium leading-relaxed">
            {t("landing.heroSubtitle")}
          </p>
        </div>

        <div className="relative z-20 w-full animate-float" style={{ animationDelay: "0.2s" }}>
          <JoinCard />
        </div>

        <p className="relative z-10 text-center font-mono text-sm text-muted-foreground mt-8">
          {t("landing.makeGame")}{" "}
          <Link
            className="font-bold text-accent hover:text-glow-accent transition-all uppercase tracking-widest"
            href="/sign-in"
          >
            {t("landing.authenticate")}
          </Link>
        </p>
      </section>

      {/* ── Horizontal Ticket Scroll Features ── */}
      <section className="relative px-6 py-32 bg-background border-t-2 border-border overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-50" aria-hidden="true" />
        
        <div className="container mx-auto max-w-7xl">
          <h2 className="font-black font-display text-4xl text-foreground mb-16 uppercase tracking-tight flex items-center gap-4">
            <span className="text-sky-400 text-5xl">*</span> {t("landing.featuresTitle")}
          </h2>
          
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-8 pb-12 -mx-6 px-6 hide-scrollbar lg:grid lg:grid-cols-2 xl:grid-cols-4 lg:overflow-visible lg:px-0 lg:mx-0 lg:snap-none">
            {features.map((f, i) => {
              const iconData = FEATURE_ICONS[i];
              return (
                <div
                  className="snap-center shrink-0 w-[85vw] sm:w-[400px] lg:w-auto relative group"
                  key={f.title}
                >
                  {/* Arcade Ticket Shape wrapper */}
                  <div className="relative surface-elevated h-full p-8 border-2 border-border/50 transition-all duration-300 group-hover:border-primary group-hover:glow-border group-hover:-translate-y-2 flex flex-col gap-6"
                       style={{ borderRadius: "24px" }}>
                    
                    {/* Ticket "hole punch" decors */}
                    <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-6 rounded-full bg-background border-r-2 border-border/50 group-hover:border-primary transition-colors" />
                    <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-background border-l-2 border-border/50 group-hover:border-primary transition-colors" />

                    <div className="flex justify-between items-start">
                      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-muted border-2 border-border/50 group-hover:border-primary/50 ${iconData.color}`}>
                        <HugeiconsIcon
                          icon={iconData.icon}
                          size={32}
                          strokeWidth={2.5}
                          color="currentColor"
                        />
                      </div>
                      <span className="font-mono text-4xl font-black text-muted-foreground/20 group-hover:text-primary/10 transition-colors">
                        0{i + 1}
                      </span>
                    </div>
                    
                    <div>
                      <h3 className="font-black font-display text-2xl text-foreground uppercase mb-3">
                        {f.title}
                      </h3>
                      <p className="text-muted-foreground text-lg leading-relaxed font-medium">
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
      <section className="px-6 py-32 bg-muted/20 border-t-2 border-border relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" aria-hidden="true" />
        <div className="container mx-auto max-w-5xl relative z-10">
          <h2 className="font-black font-display text-4xl text-center text-foreground mb-24 uppercase tracking-tight">
            {t("landing.howItWorksTitle")} <span className="text-primary animate-pulse">_</span>
          </h2>
          
          <div className="relative flex flex-col sm:flex-row justify-between items-center gap-12 sm:gap-4">
            {/* The Neon Pipe (Desktop) */}
            <div className="hidden sm:block absolute top-[48px] left-[10%] right-[10%] h-2 bg-muted border-y border-border rounded-full overflow-hidden" aria-hidden="true">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent w-[200%] animate-[slide_3s_linear_infinite]" />
            </div>

            {/* The Neon Pipe (Mobile) */}
            <div className="sm:hidden absolute left-[48px] top-[10%] bottom-[10%] w-2 bg-muted border-x border-border rounded-full overflow-hidden" aria-hidden="true">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary to-transparent h-[200%] animate-[slide-vertical_3s_linear_infinite]" />
            </div>

            {steps.map((step, i) => (
              <div className="relative flex sm:flex-col items-center gap-8 sm:gap-6 text-center sm:flex-1 w-full" key={step}>
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-[2rem] bg-background border-4 border-border shadow-[0_0_0_8px_var(--background)] z-10 transition-all hover:border-primary hover:glow-primary group">
                  <span className="font-black font-mono text-4xl text-foreground transition-colors group-hover:text-primary group-hover:text-glow">
                    {i + 1}
                  </span>
                </div>
                <div className="surface-elevated p-6 rounded-2xl border-2 border-border/50 text-left sm:text-center w-full relative">
                  {/* Small triangular pointer from box to number */}
                  <div className="absolute -left-3 sm:-top-3 sm:left-1/2 top-1/2 -translate-y-1/2 sm:-translate-x-1/2 sm:translate-y-0 w-4 h-4 bg-surface-elevated border-l-2 border-b-2 sm:border-b-0 sm:border-t-2 sm:border-r-2 border-border/50 rotate-45" />
                  <p className="text-foreground text-lg font-bold">
                    {step}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Massive Arcade CTA Banner ── */}
      <section className="relative px-6 py-40 text-center overflow-hidden border-t-2 border-border bg-background">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="h-[40rem] w-[40rem] rounded-full bg-accent/10 blur-[100px] animate-pulse glow-accent" />
        </div>
        
        <div className="relative z-10 container mx-auto max-w-3xl space-y-12 surface-raised p-16 rounded-[3rem] border-4 border-accent/20">
          <h2 className="font-black font-display text-5xl sm:text-6xl text-foreground uppercase tracking-tighter drop-shadow-md">
            {t("landing.ctaTitle")}
          </h2>
          <Button
            asChild
            className="rounded-[2rem] bg-accent hover:bg-accent border-4 border-accent-foreground/20 px-12 py-8 h-auto font-black font-display text-accent-foreground text-2xl shadow-[0_0_40px_var(--accent)] hover:shadow-[0_0_60px_var(--accent)] hover:-translate-y-1 press-down transition-all uppercase tracking-wider"
          >
            <Link href="/sign-up">{t("landing.ctaButton")}</Link>
          </Button>
        </div>
      </section>

      {/* ── Monospace Footer ── */}
      <footer className="px-6 py-8 border-t border-border bg-background flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs uppercase text-muted-foreground tracking-widest">
        <div>Hakoot © {new Date().getFullYear()}</div>
        <div className="flex gap-4">
          {/* ── package.json version ── */}
          <span>{t("landing.version")} {process.env.npm_package_version}</span>
        </div>
      </footer>

      {/* Some custom inline animations for the pipes */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(50%); }
        }
        @keyframes slide-vertical {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(50%); }
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;  
          scrollbar-width: none;  
        }
      `}} />
    </div>
  );
}
