"use client";

import { useAction } from "convex/react";
import { useTranslations } from "next-intl";
import { useReducer } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";

interface PasswordFormState {
  form: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  };
  loading: boolean;
}

type PasswordFormAction =
  | {
      type: "set-field";
      field: "currentPassword" | "newPassword" | "confirmPassword";
      value: string;
    }
  | { type: "set-loading"; loading: boolean }
  | { type: "reset" };

function passwordFormReducer(
  state: PasswordFormState,
  action: PasswordFormAction
): PasswordFormState {
  switch (action.type) {
    case "set-field":
      return {
        ...state,
        form: { ...state.form, [action.field]: action.value },
      };
    case "set-loading":
      return { ...state, loading: action.loading };
    case "reset":
      return {
        form: { currentPassword: "", newPassword: "", confirmPassword: "" },
        loading: false,
      };
    default:
      return state;
  }
}

export function ChangePasswordSection() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const changePasswordAction = useAction(api.account.changePassword);
  const [{ form, loading }, dispatch] = useReducer(passwordFormReducer, {
    form: { currentPassword: "", newPassword: "", confirmPassword: "" },
    loading: false,
  });

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }
    if (form.newPassword.length < 8) {
      toast.error(t("passwordTooShort"));
      return;
    }
    dispatch({ type: "set-loading", loading: true });
    try {
      await changePasswordAction({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success(t("passwordChanged"));
      dispatch({ type: "reset" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Invalid current password")) {
        toast.error(t("invalidPassword"));
      } else {
        toast.error(tc("error"));
      }
      dispatch({ type: "set-loading", loading: false });
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border/50 bg-card/40 p-6">
      <div className="space-y-0.5">
        <h2 className="font-semibold text-foreground">{t("passwordTitle")}</h2>
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
              dispatch({
                type: "set-field",
                field: "currentPassword",
                value: e.target.value,
              })
            }
            placeholder="••••••••"
            required
            type="password"
            value={form.currentPassword}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-foreground/80 text-sm" htmlFor="new-password">
            {t("newPassword")}
          </Label>
          <Input
            autoComplete="new-password"
            className="h-11 rounded-xl border-border bg-muted/50"
            id="new-password"
            minLength={8}
            onChange={(e) =>
              dispatch({
                type: "set-field",
                field: "newPassword",
                value: e.target.value,
              })
            }
            placeholder="••••••••"
            required
            type="password"
            value={form.newPassword}
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
              dispatch({
                type: "set-field",
                field: "confirmPassword",
                value: e.target.value,
              })
            }
            placeholder="••••••••"
            required
            type="password"
            value={form.confirmPassword}
          />
        </div>
        <Button className="rounded-xl" disabled={loading} type="submit">
          {loading ? tc("loading") : t("savePassword")}
        </Button>
      </form>
    </section>
  );
}
