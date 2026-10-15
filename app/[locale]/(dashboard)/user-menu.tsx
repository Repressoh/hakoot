"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/routing";
import { releaseCachedQueries } from "@/lib/use-cached-query";

interface Props {
  children: React.ReactNode;
  defaultOpen?: boolean;
  email: string;
  name: string;
}

/** The signed-in user's menu (pages and sign-out), opened by `children` (the avatar button). */
export function UserMenu({ children, defaultOpen, email, name }: Props) {
  const t = useTranslations();
  const { push } = useRouter();
  const { signOut } = useAuthActions();

  async function handleSignOut() {
    await signOut();
    releaseCachedQueries();
    push("/");
  }

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 rounded-xl border-border/60 bg-card/95 shadow-black/20 shadow-xl backdrop-blur-xl"
      >
        <div className="px-3 py-2.5">
          <p className="font-semibold text-foreground text-sm">{name}</p>
          <p className="mt-0.5 truncate font-mono text-muted-foreground text-xs">
            {email}
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
  );
}
