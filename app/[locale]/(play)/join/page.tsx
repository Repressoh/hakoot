import { getTranslations } from "next-intl/server";
import { JoinGameForm } from "./join-game-form";

interface Props {
  searchParams: Promise<{
    session?: string;
    name?: string;
    token?: string;
    code?: string;
  }>;
}

export default async function JoinPage({ searchParams }: Props) {
  const sp = await searchParams;
  const t = await getTranslations("join");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background bg-grid p-4">
      {/* Decorative glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/4 left-1/3 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-48 w-48 rounded-full bg-accent/6 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-8">
        <div className="text-center">
          <span className="font-black font-display text-4xl text-primary tracking-tight text-glow">
            Hakoot
          </span>
        </div>

        <div className="surface-raised p-8">
          <div className="mb-6 text-center">
            <h1 className="font-bold font-display text-foreground text-lg">
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

        <p className="text-center text-sm text-muted-foreground">
          Create your own hakoot at{" "}
          <span className="font-medium font-mono text-primary/70">hakoot.app</span>
        </p>
      </div>
    </div>
  );
}
