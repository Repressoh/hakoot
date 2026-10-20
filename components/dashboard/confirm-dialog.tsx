"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
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

interface Props {
  /** The trigger button. */
  children: ReactNode;
  confirmLabel: string;
  defaultOpen?: boolean;
  description: string;
  /** Runs the action; the confirm button stays disabled until it settles. */
  onConfirm: () => Promise<void>;
  title: string;
}

/** Confirmation dialog for a destructive dashboard action, opened by `children`. */
export function ConfirmDialog({
  children,
  confirmLabel,
  defaultOpen,
  description,
  onConfirm,
  title,
}: Props) {
  const tc = useTranslations("common");
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      setBusy(false);
    } catch (error) {
      setBusy(false);
      throw error;
    }
  }

  return (
    <AlertDialog defaultOpen={defaultOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl border-border/60 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-foreground">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl border-border text-foreground hover:bg-muted/50">
            {tc("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            disabled={busy}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
