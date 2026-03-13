"use client";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { useLocale } from "next-intl";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/routing";
import { DashboardNav } from "./dashboard-nav";

function AuthRedirect() {
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    router.push(`/${locale}/sign-in`);
  }, [locale, router]);

  return null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthLoading>
        <DashboardSkeleton />
      </AuthLoading>
      <Unauthenticated>
        <AuthRedirect />
      </Unauthenticated>
      <Authenticated>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </Authenticated>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background bg-gradient-brand-radial">
      {/* Skeleton nav */}
      <header className="sticky top-0 z-40 border-border/40 border-b bg-card/60 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
          <Skeleton className="h-6 w-20 rounded-lg" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </header>
      {/* Skeleton content */}
      <main className="container mx-auto max-w-6xl flex-1 px-6 py-10">
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
      </main>
    </div>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const viewer = useQuery(api.users.viewer);

  if (!viewer) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background bg-gradient-brand-radial">
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
      <DashboardNav
        user={{
          name: viewer.name ?? "",
          email: viewer.email ?? "",
          image: viewer.image ?? null,
        }}
      />
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
