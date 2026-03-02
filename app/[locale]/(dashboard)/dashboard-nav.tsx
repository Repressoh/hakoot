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
    <header className="sticky top-0 z-40 border-border/60 border-b bg-white">
      <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          className="font-black font-display text-lg text-primary tracking-tight"
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
                className="h-9 gap-2"
                size="sm"
                variant="ghost"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage alt={user.name} src={user.image ?? undefined} />
                  <AvatarFallback className="bg-primary/10 font-bold font-display text-primary text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden font-medium text-sm sm:block">
                  {user.name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="font-medium text-sm">{user.name}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {user.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard">{t("nav.dashboard")}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
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
