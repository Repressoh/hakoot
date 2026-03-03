"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { useQuery } from "convex/react";
import { useRouter } from "@/i18n/routing";
import { api } from "@/convex/_generated/api";
import { DashboardNav } from "./dashboard-nav";
import { useEffect } from "react";

function AuthRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.push("/sign-in");
  }, [router]);
  return null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Unauthenticated>
        <AuthRedirect />
      </Unauthenticated>
      <Authenticated>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </Authenticated>
    </>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const viewer = useQuery(api.users.viewer);

  if (!viewer) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
        className="container mx-auto max-w-5xl flex-1 px-4 py-8"
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
