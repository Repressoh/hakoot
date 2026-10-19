"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "./confirm-dialog";

interface Props {
  children: React.ReactNode;
  defaultOpen?: boolean;
  gameId: Id<"games">;
}

/** Confirmation dialog for deleting a game, opened by `children` (the trigger button). */
export function DeleteGameDialog({ children, defaultOpen, gameId }: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const removeGame = useMutation(api.games.remove);

  async function handleDelete() {
    try {
      await removeGame({ gameId });
      toast.success(t("deleteSuccess"));
    } catch {
      toast.error("Failed to delete game");
    }
  }

  return (
    <ConfirmDialog
      confirmLabel={tc("delete")}
      defaultOpen={defaultOpen}
      description={t("deleteConfirm")}
      onConfirm={handleDelete}
      title={tc("delete")}
    >
      {children}
    </ConfirmDialog>
  );
}
