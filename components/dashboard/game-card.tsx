"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/routing";

const CARD_ACCENTS = [
  {
    bg: "bg-primary/8",
    border: "border-primary/20",
    icon: "bg-primary/15 text-primary",
    glow: "group-hover:shadow-[0_0_30px_var(--glow-primary)]",
  },
  {
    bg: "bg-accent/8",
    border: "border-accent/20",
    icon: "bg-accent/15 text-accent",
    glow: "group-hover:shadow-[0_0_30px_var(--glow-accent)]",
  },
  {
    bg: "bg-choice-blue/8",
    border: "border-choice-blue/20",
    icon: "bg-choice-blue/15 text-choice-blue",
    glow: "group-hover:shadow-[0_0_30px_var(--glow-blue)]",
  },
  {
    bg: "bg-choice-yellow/8",
    border: "border-choice-yellow/20",
    icon: "bg-choice-yellow/15 text-choice-yellow",
    glow: "group-hover:shadow-[0_0_25px_oklch(0.78_0.17_70/20%)]",
  },
  {
    bg: "bg-choice-green/8",
    border: "border-choice-green/20",
    icon: "bg-choice-green/15 text-choice-green",
    glow: "group-hover:shadow-[0_0_25px_oklch(0.68_0.2_150/20%)]",
  },
  {
    bg: "bg-choice-red/8",
    border: "border-choice-red/20",
    icon: "bg-choice-red/15 text-choice-red",
    glow: "group-hover:shadow-[0_0_25px_oklch(0.62_0.24_18/20%)]",
  },
];

const CARD_EMOJIS = ["🎮", "🧩", "⚡", "🎯", "🚀", "💡"];

interface Game {
  _id: Id<"games">;
  description?: string;
  stepCount: number;
  title: string;
  updatedAt: number;
}

interface Props {
  game: Game;
  index?: number;
}

export function GameCard({ game, index = 0 }: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [deleting, setDeleting] = useState(false);
  const removeGame = useMutation(api.games.remove);

  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
  const emoji = CARD_EMOJIS[index % CARD_EMOJIS.length];

  async function handleDelete() {
    setDeleting(true);
    try {
      await removeGame({ gameId: game._id });
      toast.success(t("deleteSuccess"));
    } catch {
      toast.error("Failed to delete game");
      setDeleting(false);
    }
  }

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border ${accent.border} bg-card/80 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 ${accent.glow}`}
    >
      {/* Accent top bar */}
      <div
        aria-hidden="true"
        className={`h-1 w-full ${accent.bg}`}
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary), transparent)",
          opacity: 0.3,
        }}
      />

      <div className="flex flex-1 flex-col p-5">
        {/* Icon + Title */}
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent.icon} text-lg transition-transform duration-300 group-hover:scale-110`}
          >
            {emoji}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-bold font-display text-base text-foreground leading-snug">
              {game.title}
            </h3>
            {game.description && (
              <p className="mt-1 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
                {game.description}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 font-mono text-muted-foreground text-xs">
            <svg
              aria-hidden="true"
              className="opacity-60"
              fill="none"
              height="12"
              viewBox="0 0 12 12"
              width="12"
            >
              <rect
                height="10"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
                width="10"
                x="1"
                y="1"
              />
              <path
                d="M4 4h4M4 6h4M4 8h2"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.2"
              />
            </svg>
            {t("steps", { count: game.stepCount })}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-auto flex items-center gap-2 pt-4">
          <Button
            asChild
            className="press-down h-9 flex-1 rounded-xl bg-primary/10 font-semibold text-primary text-sm transition-colors hover:bg-primary/20"
            size="sm"
            variant="ghost"
          >
            <Link href={`/games/${game._id}`}>{tc("edit")}</Link>
          </Button>
          <Button
            asChild
            className="h-9 flex-1 rounded-xl border-border/60 font-medium text-foreground/80 text-sm transition-colors hover:bg-muted/50"
            size="sm"
            variant="outline"
          >
            <Link href={`/games/${game._id}/sessions`}>Sessions</Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                aria-label={`${tc("delete")} ${game.title}`}
                className="h-9 w-9 rounded-xl text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                size="sm"
                variant="ghost"
              >
                <HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={2} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl border-border/60 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display text-foreground">
                  {tc("delete")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  {t("deleteConfirm")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl border-border text-foreground hover:bg-muted/50">
                  {tc("cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {tc("delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
