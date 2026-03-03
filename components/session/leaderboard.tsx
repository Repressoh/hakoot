import { cn } from "@/lib/utils";

interface Entry {
  name: string;
  rank: number;
  score: number;
}

interface Props {
  currentParticipantId?: string;
  entries: Entry[];
  highlightName?: string;
}

const RANK_ACCENTS: Record<number, string> = {
  1: "text-choice-yellow",
  2: "text-muted-foreground",
  3: "text-choice-red",
};

const RANK_EMOJIS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export function Leaderboard({ entries, highlightName }: Props) {
  return (
    <ol aria-label="Leaderboard" className="space-y-2">
      {entries.map((entry) => (
        <li
          className={cn(
            "flex items-center gap-3 rounded-xl p-3 transition-colors",
            highlightName === entry.name
              ? "bg-primary/15 border border-primary/30"
              : "bg-surface-soft border border-transparent",
            entry.rank <= 3 && "font-semibold"
          )}
          key={entry.rank}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-center text-sm",
              entry.rank <= 3
                ? "bg-muted font-bold font-mono"
                : "bg-muted text-muted-foreground font-mono"
            )}
          >
            {RANK_EMOJIS[entry.rank] ?? entry.rank}
          </span>
          <span className={cn(
            "flex-1 truncate",
            highlightName === entry.name ? "text-primary" : "text-foreground"
          )}>
            {entry.name}
          </span>
          <span className={cn(
            "font-mono text-sm tabular-nums",
            RANK_ACCENTS[entry.rank] ?? "text-muted-foreground"
          )}>
            {entry.score.toLocaleString()}
          </span>
        </li>
      ))}
    </ol>
  );
}
