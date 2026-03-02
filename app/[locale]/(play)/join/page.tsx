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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-brand-radial p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <span className="font-black font-display text-4xl text-white tracking-tight">
            Hakoot
          </span>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-black/10 shadow-xl">
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

        <p className="text-center text-sm text-white/40">
          Create your own hakoot at{" "}
          <span className="font-medium text-white/60">hakoot.app</span>
        </p>
      </div>
    </div>
  );
}
