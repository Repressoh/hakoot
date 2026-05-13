"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/routing";

export default function AccountSettingsPage() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const { signOut } = useAuthActions();

  const viewer = useQuery(api.users.viewer);
  const providers = useQuery(api.account.getLinkedProviders);
  const changeEmailAction = useAction(api.account.changeEmail);
  const changePasswordAction = useAction(api.account.changePassword);
  const deleteUserDataAction = useAction(api.account.deleteUserData);

  const hasPassword = providers?.includes("password") ?? false;
  const hasGoogle = providers?.includes("google") ?? false;

  // ---- Change email ----
  const [emailForm, setEmailForm] = useState({
    newEmail: "",
    currentPassword: "",
  });
  const [emailLoading, setEmailLoading] = useState(false);

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    try {
      await changeEmailAction(emailForm);
      toast.success(t("emailChanged"));
      setEmailForm({ newEmail: "", currentPassword: "" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Invalid password")) {
        toast.error(t("invalidPassword"));
      } else if (msg.includes("already in use")) {
        toast.error(t("emailTaken"));
      } else {
        toast.error(tc("error"));
      }
    } finally {
      setEmailLoading(false);
    }
  }

  // ---- Change password ----
  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwLoading, setPwLoading] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }
    if (pwForm.newPassword.length < 8) {
      toast.error(t("passwordTooShort"));
      return;
    }
    setPwLoading(true);
    try {
      await changePasswordAction({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success(t("passwordChanged"));
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Invalid current password")) {
        toast.error(t("invalidPassword"));
      } else {
        toast.error(tc("error"));
      }
    } finally {
      setPwLoading(false);
    }
  }

  // ---- Delete account ----
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    try {
      await deleteUserDataAction({});
      await signOut();
      router.replace("/");
    } catch {
      toast.error(tc("error"));
      setDeleteLoading(false);
    }
  }

  const isLoading = viewer === undefined || providers === undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="font-semibold font-display text-3xl text-foreground tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {/* Connected accounts */}
      <section className="space-y-5 rounded-2xl border border-border/50 bg-card/40 p-6">
        <div className="space-y-0.5">
          <h2 className="font-semibold text-foreground">
            {t("connectedTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("connectedDesc")}</p>
        </div>
        <Separator className="bg-border/40" />
        <div className="space-y-3">
          <ConnectedProvider
            icon="G"
            linked={isLoading ? false : hasGoogle}
            loading={isLoading}
            name="Google"
          />
          <ConnectedProvider
            icon="@"
            linked={isLoading ? false : hasPassword}
            loading={isLoading}
            name={t("emailPassword")}
          />
        </div>
      </section>

      {/* Change email — only shown for password accounts */}
      {(hasPassword || isLoading) && (
        <section className="space-y-5 rounded-2xl border border-border/50 bg-card/40 p-6">
          <div className="space-y-0.5">
            <h2 className="font-semibold text-foreground">{t("emailTitle")}</h2>
            <p className="text-muted-foreground text-sm">
              {viewer?.email && (
                <span className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-muted-foreground/70 text-xs">
                  {viewer.email}
                </span>
              )}
            </p>
          </div>
          <Separator className="bg-border/40" />
          <form className="space-y-4" onSubmit={handleChangeEmail}>
            <div className="space-y-1.5">
              <Label className="text-foreground/80 text-sm" htmlFor="new-email">
                {t("newEmail")}
              </Label>
              <Input
                autoComplete="email"
                className="h-11 rounded-xl border-border bg-muted/50"
                id="new-email"
                onChange={(e) =>
                  setEmailForm((f) => ({ ...f, newEmail: e.target.value }))
                }
                placeholder={t("newEmailPlaceholder")}
                required
                type="email"
                value={emailForm.newEmail}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                className="text-foreground/80 text-sm"
                htmlFor="email-password"
              >
                {t("confirmWithPassword")}
              </Label>
              <Input
                autoComplete="current-password"
                className="h-11 rounded-xl border-border bg-muted/50"
                id="email-password"
                onChange={(e) =>
                  setEmailForm((f) => ({
                    ...f,
                    currentPassword: e.target.value,
                  }))
                }
                placeholder="••••••••"
                required
                type="password"
                value={emailForm.currentPassword}
              />
            </div>
            <Button
              className="rounded-xl"
              disabled={emailLoading}
              type="submit"
            >
              {emailLoading ? tc("loading") : t("saveEmail")}
            </Button>
          </form>
        </section>
      )}

      {/* Change password — only shown for password accounts */}
      {(hasPassword || isLoading) && (
        <section className="space-y-5 rounded-2xl border border-border/50 bg-card/40 p-6">
          <div className="space-y-0.5">
            <h2 className="font-semibold text-foreground">
              {t("passwordTitle")}
            </h2>
            <p className="text-muted-foreground text-sm">{t("passwordDesc")}</p>
          </div>
          <Separator className="bg-border/40" />
          <form className="space-y-4" onSubmit={handleChangePassword}>
            <div className="space-y-1.5">
              <Label
                className="text-foreground/80 text-sm"
                htmlFor="current-password"
              >
                {t("currentPassword")}
              </Label>
              <Input
                autoComplete="current-password"
                className="h-11 rounded-xl border-border bg-muted/50"
                id="current-password"
                onChange={(e) =>
                  setPwForm((f) => ({
                    ...f,
                    currentPassword: e.target.value,
                  }))
                }
                placeholder="••••••••"
                required
                type="password"
                value={pwForm.currentPassword}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                className="text-foreground/80 text-sm"
                htmlFor="new-password"
              >
                {t("newPassword")}
              </Label>
              <Input
                autoComplete="new-password"
                className="h-11 rounded-xl border-border bg-muted/50"
                id="new-password"
                minLength={8}
                onChange={(e) =>
                  setPwForm((f) => ({ ...f, newPassword: e.target.value }))
                }
                placeholder="••••••••"
                required
                type="password"
                value={pwForm.newPassword}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                className="text-foreground/80 text-sm"
                htmlFor="confirm-password"
              >
                {t("confirmPassword")}
              </Label>
              <Input
                autoComplete="new-password"
                className="h-11 rounded-xl border-border bg-muted/50"
                id="confirm-password"
                minLength={8}
                onChange={(e) =>
                  setPwForm((f) => ({
                    ...f,
                    confirmPassword: e.target.value,
                  }))
                }
                placeholder="••••••••"
                required
                type="password"
                value={pwForm.confirmPassword}
              />
            </div>
            <Button className="rounded-xl" disabled={pwLoading} type="submit">
              {pwLoading ? tc("loading") : t("savePassword")}
            </Button>
          </form>
        </section>
      )}

      {/* Danger zone */}
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
    </div>
  );
}

function ConnectedProvider({
  icon,
  name,
  linked,
  loading,
}: {
  icon: string;
  name: string;
  linked: boolean;
  loading: boolean;
}) {
  const t = useTranslations("settings");
  let badge: ReactNode;
  if (loading) {
    badge = <span className="h-5 w-16 animate-pulse rounded-md bg-muted" />;
  } else if (linked) {
    badge = (
      <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-medium text-primary text-xs ring-1 ring-primary/20">
        {t("connected")}
      </span>
    );
  } else {
    badge = (
      <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground text-xs ring-1 ring-border/30">
        {t("notConnected")}
      </span>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted font-bold text-foreground text-sm ring-1 ring-border/40">
          {icon}
        </span>
        <span className="font-medium text-foreground text-sm">{name}</span>
      </div>
      {badge}
    </div>
  );
}
