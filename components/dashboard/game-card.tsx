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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link, useRouter } from "@/i18n/routing";
import { deleteGame } from "@/lib/actions/game";

interface Game {
  description: string | null;
  id: string;
  stepCount: number;
  title: string;
  updatedAt: Date;
}

interface Props {
  game: Game;
}

export function GameCard({ game }: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

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
    <Card className="group flex flex-col rounded-xl border-border/50 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-2 font-bold font-display text-base leading-snug">
          {game.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {game.description && (
          <p className="line-clamp-2 text-muted-foreground text-sm">
            {game.description}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Badge
            className="bg-primary/10 text-primary text-xs hover:bg-primary/15"
            variant="secondary"
          >
            {t("steps", { count: game.stepCount })}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 pt-0">
        <Button asChild className="flex-1" size="sm">
          <Link href={`/games/${game.id}`}>{tc("edit")}</Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              aria-label={`${tc("delete")} ${game.title}`}
              className="text-muted-foreground hover:text-destructive"
              size="sm"
              variant="ghost"
            >
              <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tc("delete")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteConfirm")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleting}
                onClick={handleDelete}
              >
                {tc("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
