"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { ChangeEmailSection } from "@/components/settings/change-email-section";
import { ChangePasswordSection } from "@/components/settings/change-password-section";
import { ConnectedProvider } from "@/components/settings/connected-provider";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";

export default function AccountSettingsPage() {
  const t = useTranslations("settings");
  const viewer = useQuery(api.users.viewer);
  const providers = useQuery(api.account.getLinkedProviders);

  const hasPassword = providers?.includes("password") ?? false;
  const hasGoogle = providers?.includes("google") ?? false;
  const isLoading = viewer === undefined || providers === undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div className="space-y-1.5">
        <h1 className="font-display font-semibold text-3xl text-foreground tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

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

      {(hasPassword || isLoading) && (
        <ChangeEmailSection currentEmail={viewer?.email} />
      )}

      {(hasPassword || isLoading) && <ChangePasswordSection />}

      <DeleteAccountSection />
    </div>
  );
}
