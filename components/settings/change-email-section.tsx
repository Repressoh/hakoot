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

interface EmailFormState {
  form: { newEmail: string; currentPassword: string };
  loading: boolean;
}

type EmailFormAction =
  | { type: "set-field"; field: "newEmail" | "currentPassword"; value: string }
  | { type: "set-loading"; loading: boolean }
  | { type: "reset" };

function emailFormReducer(
  state: EmailFormState,
  action: EmailFormAction
): EmailFormState {
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
        form: { newEmail: "", currentPassword: "" },
        loading: false,
      };
    default:
      return state;
  }
}

export function ChangeEmailSection({
  currentEmail,
}: {
  currentEmail?: string;
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const changeEmailAction = useAction(api.account.changeEmail);
  const [{ form, loading }, dispatch] = useReducer(emailFormReducer, {
    form: { newEmail: "", currentPassword: "" },
    loading: false,
  });

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "set-loading", loading: true });
    try {
      await changeEmailAction(form);
      toast.success(t("emailChanged"));
      dispatch({ type: "reset" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Invalid password")) {
        toast.error(t("invalidPassword"));
      } else if (msg.includes("already in use")) {
        toast.error(t("emailTaken"));
      } else {
        toast.error(tc("error"));
      }
      dispatch({ type: "set-loading", loading: false });
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border/50 bg-card/40 p-6">
      <div className="space-y-0.5">
        <h2 className="font-semibold text-foreground">{t("emailTitle")}</h2>
        <p className="text-muted-foreground text-sm">
          {currentEmail && (
            <span className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-muted-foreground/70 text-xs">
              {currentEmail}
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
              dispatch({
                type: "set-field",
                field: "newEmail",
                value: e.target.value,
              })
            }
            placeholder={t("newEmailPlaceholder")}
            required
            type="email"
            value={form.newEmail}
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
        <Button className="rounded-xl" disabled={loading} type="submit">
          {loading ? tc("loading") : t("saveEmail")}
        </Button>
      </form>
    </section>
  );
}
