"use client";

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
import { signOut } from "@/lib/auth-client";
import type { User } from "@/lib/db/schema";

interface Props {
  user: Pick<User, "name" | "email" | "image">;
}

export function DashboardNav({ user }: Props) {
  const t = useTranslations();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          className="font-black font-display text-lg text-primary tracking-tight text-glow"
          href="/dashboard"
        >
          Hakoot
        </Link>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="User menu"
                className="h-9 gap-2 text-foreground hover:bg-muted/50"
                size="sm"
                variant="ghost"
              >
                <Avatar className="h-7 w-7 ring-1 ring-border">
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
            <DropdownMenuContent align="end" className="w-48 surface-elevated border-border">
              <div className="px-2 py-1.5">
                <p className="font-medium text-sm text-foreground">{user.name}</p>
                <p className="truncate text-muted-foreground text-xs font-mono">
                  {user.email}
                </p>
              </div>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem asChild className="text-foreground focus:bg-muted/50">
                <Link href="/dashboard">{t("nav.dashboard")}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
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
