import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { JoinGameForm } from "./join-game-form";

export const metadata: Metadata = {
  title: "Join Game - Hakoot",
};

interface Props {
  searchParams: Promise<{
    session?: string;
    name?: string;
    token?: string;
    code?: string;
  }>;
}

export default async function JoinPage({ searchParams }: Props) {
  const [sp, t] = await Promise.all([
    searchParams,
    getTranslations("join"),
  ]);

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

      <div className="relative w-full max-w-sm space-y-8">
        <div className="text-center">
          <span className="font-black font-display text-4xl text-glow text-primary tracking-tight">
            Hakoot
          </span>
        </div>

        <div className="surface-raised p-8">
          <div className="mb-6 text-center">
            <h1 className="font-semibold font-display text-foreground text-lg">
              {t("title")}
            </h1>
          </div>
          <JoinGameForm
            prefilledCode={sp.code}
            prefilledName={sp.name}
            prefilledSessionId={sp.session}
            prefilledToken={sp.token}
          />
        </div>

        <p className="text-center text-muted-foreground text-sm">
          Create your own hakoot at{" "}
          <span className="font-medium font-mono text-primary/70">
            hakoot.app
          </span>
        </p>
      </div>
    </div>
  );
}
