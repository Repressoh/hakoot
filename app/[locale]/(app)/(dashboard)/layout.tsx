"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useEffect } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardHeader, DashboardNav } from "./dashboard-nav";

function AuthRedirect() {
  useEffect(() => {
    window.location.href = "/sign-in";
  }, []);

  return null;
}

/**
 * Dashboard shell. Pages mount as soon as a stored sign-in token is found, without waiting for the
 * server to confirm it: the Convex client sends the token before any query on the new connection,
 * so the page's queries share that round trip instead of each adding their own.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const token = useAuthToken();

  if (!(isLoading || isAuthenticated)) {
    return <AuthRedirect />;
  }

  // The stored token is read after the first render (and the server never has
  // it); until then we don't know whether anyone is signed in, so hold off on
  // queries. The shell stays mounted when the token is found: only the user
  // menu and the page replace their placeholders.
  if (token === null) {
    return (
      <DashboardShell
        loading
        nav={
          <DashboardHeader>
            <LocaleSwitcher />
            <Skeleton className="size-8 rounded-full" />
          </DashboardHeader>
        }
      >
        <PageSkeleton />
      </DashboardShell>
    );
  }

  return <DashboardShell nav={<DashboardNav />}>{children}</DashboardShell>;
}

function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {["a", "b", "c"].map((id) => (
          <Skeleton className="h-48 rounded-2xl" key={id} />
        ))}
      </div>
    </div>
  );
}

function DashboardShell({
  children,
  loading = false,
  nav,
}: {
  children: React.ReactNode;
  /** Server-rendered loading state: text in the fallback fonts (see globals.css). */
  loading?: boolean;
  nav: React.ReactNode;
}) {
  return (
    <div
      className="relative flex min-h-screen flex-col bg-background bg-gradient-brand-radial"
      data-fallback-fonts={loading ? "" : undefined}
    >
      {/* Subtle grid texture overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-grid opacity-40"
      />

      <a
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:font-medium focus:text-sm focus:ring-2 focus:ring-ring"
        href="#main-content"
      >
        Skip to main content
      </a>
      {nav}
      <main
        className="container relative mx-auto max-w-6xl flex-1 px-6 py-10"
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
