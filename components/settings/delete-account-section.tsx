"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
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
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/routing";

export function DeleteAccountSection() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { replace } = useRouter();
  const { signOut } = useAuthActions();
  const deleteUserDataAction = useAction(api.account.deleteUserData);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    try {
      await deleteUserDataAction({});
      await signOut();
      replace("/");
    } catch {
      toast.error(tc("error"));
      setDeleteLoading(false);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="space-y-0.5">
        <h2 className="font-semibold text-destructive">{t("dangerTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("dangerDesc")}</p>
      </div>
      <Separator className="bg-destructive/20" />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            className="rounded-xl"
            disabled={deleteLoading}
            variant="destructive"
          >
            {t("deleteAccount")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLoading}
              onClick={handleDeleteAccount}
            >
              {deleteLoading ? tc("loading") : t("deleteConfirmButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
