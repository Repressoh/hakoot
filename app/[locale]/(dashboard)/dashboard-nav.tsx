"use client";

import { useQuery } from "convex/react";
import { type ComponentProps, lazy, Suspense } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/routing";
import { useLazyOpen } from "@/lib/use-lazy-open";

// The menu (Radix dropdown, positioning, scroll locking) loads after the nav
// shows, keeping it out of the initial JavaScript; until then the avatar
// button is shown without it.
const UserMenu = lazy(() =>
  import("./user-menu").then((mod) => ({ default: mod.UserMenu }))
);

/** Dashboard header with navigation links and the signed-in user's menu (including sign-out). */
export function DashboardNav() {
  const viewer = useQuery(api.users.viewer);
  const userMenu = useLazyOpen();
  const user = {
    email: viewer?.email ?? "",
    image: viewer?.image ?? null,
    name: viewer?.name ?? "",
  };

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const userButton = (props?: ComponentProps<typeof Button>) => (
    <Button
      aria-label="User menu"
      className="h-9 gap-2.5 rounded-xl text-foreground transition-colors hover:bg-muted/60"
      size="sm"
      variant="ghost"
      {...props}
    >
      <Avatar className="size-7 ring-2 ring-primary/20 transition-shadow group-hover:ring-primary/40">
        <AvatarImage alt={user.name} src={user.image ?? undefined} />
        <AvatarFallback className="bg-primary/15 font-bold font-mono text-primary text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="hidden font-medium text-sm sm:block">{user.name}</span>
    </Button>
  );

  return (
    <DashboardHeader>
      <LocaleSwitcher />
      {viewer ? (
        <Suspense fallback={userButton(userMenu.placeholderProps)}>
          <UserMenu
            defaultOpen={userMenu.defaultOpen}
            email={user.email}
            name={user.name}
          >
            {userButton()}
          </UserMenu>
        </Suspense>
      ) : (
        <Skeleton className="size-8 rounded-full" />
      )}
    </DashboardHeader>
  );
}

/**
 * The dashboard header's frame and logo, with `children` on the right. Also rendered by the
 * layout's loading state, so the server-rendered page already shows the real header.
 */
export function DashboardHeader({ children }: { children: React.ReactNode }) {
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

        <div className="flex items-center gap-1.5">{children}</div>
      </div>
    </header>
  );
}
