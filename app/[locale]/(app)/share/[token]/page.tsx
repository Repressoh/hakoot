import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SharedGameView } from "./shared-game-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sharing");
  // Whoever has the link can host the game: keep it out of search results.
  return { robots: { follow: false, index: false }, title: t("pageTitle") };
}

export default async function SharedGamePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background bg-grid p-4">
      {/* Decorative glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute top-1/4 left-1/3 size-72 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 size-48 rounded-full bg-accent/6 blur-3xl" />
      </div>

      <main className="relative w-full max-w-md space-y-8">
        <div className="text-center">
          <span className="font-black font-display text-4xl text-glow text-primary tracking-tight">
            Hakoot
          </span>
        </div>

        <SharedGameView shareToken={token} />
      </main>
    </div>
  );
}
