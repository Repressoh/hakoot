"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { Link, useRouter } from "@/i18n/routing";
import { deleteGame } from "@/lib/actions/game";

const STRIPE_COLORS = [
  "bg-primary",
  "bg-accent",
  "bg-choice-blue",
  "bg-choice-yellow",
  "bg-choice-green",
  "bg-choice-red",
];

interface Game {
  description: string | null;
  id: string;
  stepCount: number;
  title: string;
  updatedAt: Date;
}

interface Props {
  game: Game;
  index?: number;
}

export function GameCard({ game, index = 0 }: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const stripeColor = STRIPE_COLORS[index % STRIPE_COLORS.length];

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteGame(game.id);
      toast.success(t("deleteSuccess"));
      router.refresh();
    } catch {
      toast.error("Failed to delete game");
      setDeleting(false);
    }
  }

  return (
    <div className="group relative flex overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:glow-border">
      {/* Color stripe */}
      <div className={`w-1.5 flex-shrink-0 ${stripeColor}`} aria-hidden="true" />

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 font-bold font-display text-base text-foreground leading-snug">
          {game.title}
        </h3>

        {game.description && (
          <p className="mt-1.5 line-clamp-2 text-muted-foreground text-sm">
            {game.description}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <span className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-0.5 font-mono text-primary text-xs">
            {t("steps", { count: game.stepCount })}
          </span>
        </div>

        <div className="mt-4 flex gap-2 pt-2 border-t border-border/50">
          <Button
            asChild
            className="flex-1 h-9 rounded-xl bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 press-down"
            size="sm"
            variant="ghost"
          >
            <Link href={`/games/${game.id}`}>{tc("edit")}</Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                aria-label={`${tc("delete")} ${game.title}`}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                size="sm"
                variant="ghost"
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="surface-elevated border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground">{tc("delete")}</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  {t("deleteConfirm")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border text-foreground hover:bg-muted/50">{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
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
