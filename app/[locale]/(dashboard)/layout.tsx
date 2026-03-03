import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getSession } from "@/lib/actions/auth";
import { DashboardNav } from "./dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const locale = await getLocale();

  if (!session) {
    redirect({ href: "/sign-in", locale });
  }

  const currentUser = session?.user;

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
          name: currentUser?.name ?? "",
          email: currentUser?.email ?? "",
          image: currentUser?.image ?? null,
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
