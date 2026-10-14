"use client";

// biome-ignore lint/performance/noNamespaceImport: motion/react-client requires namespace import
import * as motion from "motion/react-client";
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

/** Grid of the user's games, or an empty state when there are none. */
export function GameList({ games }: Props) {
  const t = useTranslations("dashboard");

  if (games.length === 0) {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center rounded-2xl border-2 border-border/30 border-dashed bg-card/30 py-24"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="flex size-16 animate-float items-center justify-center rounded-2xl bg-primary/10 text-3xl shadow-[0_0_20px_var(--glow-subtle)]">
          🎮
        </div>
        <p className="mt-5 font-bold font-display text-foreground text-lg">
          {t("emptyTitle")}
        </p>
        <p className="mt-1.5 max-w-xs text-center text-muted-foreground text-sm leading-relaxed">
          {t("emptyDesc")}
        </p>
      </motion.div>
    );
  }

  return (
    <ul
      aria-label="Your games"
      className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3"
    >
      {games.map((game, i) => (
        <motion.li
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 16 }}
          key={game._id}
          transition={{
            delay: i * 0.06,
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          <GameCard game={game} index={i} />
        </motion.li>
      ))}
    </ul>
  );
}
