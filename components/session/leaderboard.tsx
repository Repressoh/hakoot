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

const RANK_COLORS: Record<number, string> = {
  1: "bg-amber-400 text-amber-950",
  2: "bg-gray-300 text-gray-700",
  3: "bg-amber-600 text-white",
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
              ? "bg-primary text-primary-foreground"
              : "bg-surface-soft",
            entry.rank <= 3 && "font-semibold"
          )}
          key={entry.rank}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-center text-sm",
              RANK_COLORS[entry.rank] ?? "bg-muted text-muted-foreground"
            )}
          >
            {RANK_EMOJIS[entry.rank] ?? entry.rank}
          </span>
          <span className="flex-1 truncate">{entry.name}</span>
          <span className="font-mono text-sm tabular-nums">
            {entry.score.toLocaleString()}
          </span>
        </li>
      ))}
    </ol>
  );
}
