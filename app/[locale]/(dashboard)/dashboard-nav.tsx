"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/routing";

interface Props {
  user: { name: string; email: string; image: string | null };
}

export function DashboardNav({ user }: Props) {
  const t = useTranslations();
  const { push } = useRouter();
  const { signOut } = useAuthActions();

  async function handleSignOut() {
    await signOut();
    push("/");
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-40 border-border/40 border-b bg-background/70 backdrop-blur-xl">
      {/* Subtle glow line at bottom of nav */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
      />

      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          className="group flex items-center gap-2.5 font-black font-display text-lg tracking-tight"
          href="/dashboard"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-black text-primary-foreground text-sm shadow-[0_0_12px_var(--glow-primary)] transition-shadow group-hover:shadow-[0_0_20px_var(--glow-primary)]">
            H
          </span>
          <span className="text-foreground transition-colors group-hover:text-primary">
            akoot
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <LocaleSwitcher />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="User menu"
                className="h-9 gap-2.5 rounded-xl text-foreground transition-colors hover:bg-muted/60"
                size="sm"
                variant="ghost"
              >
                <Avatar className="size-7 ring-2 ring-primary/20 transition-shadow group-hover:ring-primary/40">
                  <AvatarImage alt={user.name} src={user.image ?? undefined} />
                  <AvatarFallback className="bg-primary/15 font-bold font-mono text-primary text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden font-medium text-sm sm:block">
                  {user.name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 rounded-xl border-border/60 bg-card/95 shadow-black/20 shadow-xl backdrop-blur-xl"
            >
              <div className="px-3 py-2.5">
                <p className="font-semibold text-foreground text-sm">
                  {user.name}
                </p>
                <p className="mt-0.5 truncate font-mono text-muted-foreground text-xs">
                  {user.email}
                </p>
              </div>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem
                asChild
                className="mx-1 rounded-lg text-foreground focus:bg-muted/50"
              >
                <Link href="/dashboard">{t("nav.dashboard")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                className="mx-1 rounded-lg text-foreground focus:bg-muted/50"
              >
                <Link href="/email-lists">{t("nav.emailLists")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                className="mx-1 rounded-lg text-foreground focus:bg-muted/50"
              >
                <Link href="/settings">{t("nav.accountSettings")}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem
                className="mx-1 rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={handleSignOut}
              >
                {t("nav.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
