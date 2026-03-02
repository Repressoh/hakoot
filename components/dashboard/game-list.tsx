import { getTranslations } from "next-intl/server";
import { GameCard } from "./game-card";

interface Game {
  description: string | null;
  id: string;
  stepCount: number;
  title: string;
  updatedAt: Date;
}

interface Props {
  games: Game[];
}

export async function GameList({ games }: Props) {
  const t = await getTranslations("dashboard");

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-border/50 border-dashed py-20">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl">
          🎮
        </div>
        <p className="mt-4 font-bold font-display text-lg">{t("emptyTitle")}</p>
        <p className="mt-1 max-w-xs text-center text-muted-foreground text-sm">
          {t("emptyDesc")}
        </p>
      </div>
    );
  }

  return (
    <ul
      aria-label="Your games"
      className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3"
    >
      {games.map((game) => (
        <li key={game.id}>
          <GameCard game={game} />
        </li>
      ))}
    </ul>
  );
}
