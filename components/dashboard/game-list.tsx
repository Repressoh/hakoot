"use client";

import { useTranslations } from "next-intl";
import type { Id } from "@/convex/_generated/dataModel";
import { GameCard } from "./game-card";

interface Game {
  _id: Id<"games">;
  description?: string;
  stepCount: number;
  title: string;
  updatedAt: number;
}

interface Props {
  games: Game[];
}

/**
 * Entrance delay of the i-th card. Capped so cards further down (usually off screen at first)
 * don't stay hidden while the earlier ones animate in.
 */
function staggerDelay(i: number) {
  return `${Math.min(i, 6) * 60}ms`;
}

/** Grid of the user's games, or an empty state when there are none. */
export function GameList({ games }: Props) {
  const t = useTranslations("dashboard");

  if (games.length === 0) {
    return (
      <div className="fade-in slide-in-from-bottom-3 animation-duration-500 flex animate-in flex-col items-center justify-center rounded-2xl border-2 border-border/30 border-dashed bg-card/30 py-24 ease-out motion-reduce:animate-none">
        <div className="flex size-16 animate-float items-center justify-center rounded-2xl bg-primary/10 text-3xl shadow-[0_0_20px_var(--glow-subtle)]">
          🎮
        </div>
        <p className="mt-5 font-bold font-display text-foreground text-lg">
          {t("emptyTitle")}
        </p>
        <p className="mt-1.5 max-w-xs text-center text-muted-foreground text-sm leading-relaxed">
          {t("emptyDesc")}
        </p>
      </div>
    );
  }

  return (
    <ul
      aria-label="Your games"
      className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3"
    >
      {games.map((game, i) => (
        <li
          className="fade-in slide-in-from-bottom-4 animation-duration-400 animate-in fill-mode-backwards ease-out motion-reduce:animate-none"
          key={game._id}
          style={{ animationDelay: staggerDelay(i) }}
        >
          <GameCard game={game} index={i} />
        </li>
      ))}
    </ul>
  );
}
