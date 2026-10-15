"use client";

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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface Props {
  children: React.ReactNode;
  defaultOpen?: boolean;
  gameId: Id<"games">;
}

/** Confirmation dialog for deleting a game, opened by `children` (the trigger button). */
export function DeleteGameDialog({ children, defaultOpen, gameId }: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [deleting, setDeleting] = useState(false);
  const removeGame = useMutation(api.games.remove);

  async function handleDelete() {
    setDeleting(true);
    try {
      await removeGame({ gameId });
      toast.success(t("deleteSuccess"));
    } catch {
      setDeleting(false);
      toast.error("Failed to delete game");
    }
  }

  return (
    <AlertDialog defaultOpen={defaultOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
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
  );
}
