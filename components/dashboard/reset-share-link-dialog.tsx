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

/** Confirmation dialog for replacing a game's share link, opened by `children` (the trigger). */
export function ResetShareLinkDialog({ children, defaultOpen, gameId }: Props) {
  const t = useTranslations("sharing");
  const resetShareLink = useMutation(api.sharing.resetShareLink);

  async function handleReset() {
    try {
      await resetShareLink({ gameId });
      toast.success(t("resetSuccess"));
    } catch {
      toast.error(t("updateFailed"));
    }
  }

  return (
    <ConfirmDialog
      confirmLabel={t("resetLink")}
      defaultOpen={defaultOpen}
      description={t("resetDescription")}
      onConfirm={handleReset}
      title={t("resetTitle")}
    >
      {children}
    </ConfirmDialog>
  );
}
