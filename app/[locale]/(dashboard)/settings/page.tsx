"use client";

import { useAction, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/routing";
import { useAuthActions } from "@convex-dev/auth/react";
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
        <h1 className="font-black font-display text-3xl text-foreground tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {/* Connected accounts */}
      <section className="rounded-2xl border border-border/50 bg-card/40 p-6 space-y-5">
        <div className="space-y-0.5">
          <h2 className="font-semibold text-foreground">{t("connectedTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("connectedDesc")}</p>
        </div>
        <Separator className="bg-border/40" />
        <div className="space-y-3">
          <ConnectedProvider
            icon="G"
            name="Google"
            linked={isLoading ? false : hasGoogle}
            loading={isLoading}
          />
          <ConnectedProvider
            icon="@"
            name={t("emailPassword")}
            linked={isLoading ? false : hasPassword}
            loading={isLoading}
          />
        </div>
      </section>

      {/* Change email — only shown for password accounts */}
      {(hasPassword || isLoading) && (
        <section className="rounded-2xl border border-border/50 bg-card/40 p-6 space-y-5">
          <div className="space-y-0.5">
            <h2 className="font-semibold text-foreground">{t("emailTitle")}</h2>
            <p className="text-muted-foreground text-sm">
              {viewer?.email && (
                <span className="font-mono text-xs text-muted-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded-md">
                  {viewer.email}
                </span>
              )}
            </p>
          </div>
          <Separator className="bg-border/40" />
          <form className="space-y-4" onSubmit={handleChangeEmail}>
            <div className="space-y-1.5">
              <Label htmlFor="new-email" className="text-foreground/80 text-sm">
                {t("newEmail")}
              </Label>
              <Input
                id="new-email"
                type="email"
                autoComplete="email"
                required
                value={emailForm.newEmail}
                onChange={(e) =>
                  setEmailForm((f) => ({ ...f, newEmail: e.target.value }))
                }
                className="h-11 rounded-xl border-border bg-muted/50"
                placeholder={t("newEmailPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="email-password"
                className="text-foreground/80 text-sm"
              >
                {t("confirmWithPassword")}
              </Label>
              <Input
                id="email-password"
                type="password"
                autoComplete="current-password"
                required
                value={emailForm.currentPassword}
                onChange={(e) =>
                  setEmailForm((f) => ({
                    ...f,
                    currentPassword: e.target.value,
                  }))
                }
                className="h-11 rounded-xl border-border bg-muted/50"
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              disabled={emailLoading}
              className="rounded-xl"
            >
              {emailLoading ? tc("loading") : t("saveEmail")}
            </Button>
          </form>
        </section>
      )}

      {/* Change password — only shown for password accounts */}
      {(hasPassword || isLoading) && (
        <section className="rounded-2xl border border-border/50 bg-card/40 p-6 space-y-5">
          <div className="space-y-0.5">
            <h2 className="font-semibold text-foreground">{t("passwordTitle")}</h2>
            <p className="text-muted-foreground text-sm">{t("passwordDesc")}</p>
          </div>
          <Separator className="bg-border/40" />
          <form className="space-y-4" onSubmit={handleChangePassword}>
            <div className="space-y-1.5">
              <Label
                htmlFor="current-password"
                className="text-foreground/80 text-sm"
              >
                {t("currentPassword")}
              </Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                required
                value={pwForm.currentPassword}
                onChange={(e) =>
                  setPwForm((f) => ({
                    ...f,
                    currentPassword: e.target.value,
                  }))
                }
                className="h-11 rounded-xl border-border bg-muted/50"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="new-password"
                className="text-foreground/80 text-sm"
              >
                {t("newPassword")}
              </Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={pwForm.newPassword}
                onChange={(e) =>
                  setPwForm((f) => ({ ...f, newPassword: e.target.value }))
                }
                className="h-11 rounded-xl border-border bg-muted/50"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="confirm-password"
                className="text-foreground/80 text-sm"
              >
                {t("confirmPassword")}
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={pwForm.confirmPassword}
                onChange={(e) =>
                  setPwForm((f) => ({
                    ...f,
                    confirmPassword: e.target.value,
                  }))
                }
                className="h-11 rounded-xl border-border bg-muted/50"
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              disabled={pwLoading}
              className="rounded-xl"
            >
              {pwLoading ? tc("loading") : t("savePassword")}
            </Button>
          </form>
        </section>
      )}

      {/* Danger zone */}
      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-5">
        <div className="space-y-0.5">
          <h2 className="font-semibold text-destructive">{t("dangerTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("dangerDesc")}</p>
        </div>
        <Separator className="bg-destructive/20" />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={deleteLoading}
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
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
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
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted font-bold text-foreground text-sm ring-1 ring-border/40">
          {icon}
        </span>
        <span className="font-medium text-foreground text-sm">{name}</span>
      </div>
      {loading ? (
        <span className="h-5 w-16 animate-pulse rounded-md bg-muted" />
      ) : linked ? (
        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-medium text-primary text-xs ring-1 ring-primary/20">
          {t("connected")}
        </span>
      ) : (
        <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground text-xs ring-1 ring-border/30">
          {t("notConnected")}
        </span>
      )}
    </div>
  );
}
