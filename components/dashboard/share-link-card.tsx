"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import {
  type ComponentProps,
  lazy,
  Suspense,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLazyOpen } from "@/lib/use-lazy-open";

// The dialog (Radix, focus trapping, scroll locking) loads after the editor
// shows, keeping it out of the initial JavaScript; until then the button is
// shown without it.
const ResetShareLinkDialog = lazy(() =>
  import("./reset-share-link-dialog").then((mod) => ({
    default: mod.ResetShareLinkDialog,
  }))
);

/** The page's origin doesn't change while it is open. */
function subscribe(): () => void {
  return () => undefined;
}

/**
 * The share link's URL. It has no locale, so each visitor is sent to the page in their own
 * language.
 */
function useShareUrl(shareToken: string): string {
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => ""
  );
  return `${origin}/share/${shareToken}`;
}

/** The link's URL with buttons to copy it and to replace it with a new one. */
function ShareLinkField({
  gameId,
  shareToken,
}: {
  gameId: Id<"games">;
  shareToken: string;
}) {
  const t = useTranslations("sharing");
  const url = useShareUrl(shareToken);
  const resetDialog = useLazyOpen();
  const resetButton = (props?: ComponentProps<typeof Button>) => (
    <Button
      className="rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      size="sm"
      variant="ghost"
      {...props}
    >
      {t("resetLink")}
    </Button>
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied"));
    } catch {
      toast.error(t("copyLinkFailed"));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          aria-label={t("linkLabel")}
          className="h-10 rounded-xl border-border/60 bg-muted/40 font-mono text-foreground text-xs"
          onFocus={(e) => e.currentTarget.select()}
          readOnly
          value={url}
        />
        <Button
          className="press-down h-10 shrink-0 rounded-xl bg-primary/10 font-semibold text-primary hover:bg-primary/20"
          onClick={handleCopy}
          variant="ghost"
        >
          {t("copyLink")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{t("offNote")}</p>
        <Suspense fallback={resetButton(resetDialog.placeholderProps)}>
          <ResetShareLinkDialog
            defaultOpen={resetDialog.defaultOpen}
            gameId={gameId}
          >
            {resetButton()}
          </ResetShareLinkDialog>
        </Suspense>
      </div>
    </div>
  );
}

interface Props {
  gameId: Id<"games">;
  shareEnabled: boolean;
  /** Set while sharing is on. */
  shareToken: string | null;
}

/**
 * The game's share link: a switch to turn it on or off (off by default) and, while on, the link.
 * Anyone with it can host the game; signed-in users can also copy it.
 */
export function ShareLinkCard({ gameId, shareEnabled, shareToken }: Props) {
  const t = useTranslations("sharing");
  const setShareEnabled = useMutation(api.sharing.setShareEnabled);
  const [updating, setUpdating] = useState(false);

  async function handleCheckedChange(enabled: boolean) {
    setUpdating(true);
    try {
      await setShareEnabled({ enabled, gameId });
      toast.success(enabled ? t("enabled") : t("disabled"));
    } catch {
      toast.error(t("updateFailed"));
    }
    setUpdating(false);
  }

  return (
    <section
      aria-labelledby="share-link-title"
      className="space-y-4 rounded-2xl border border-border/60 bg-card/80 p-6"
    >
      <div className="space-y-1">
        <h2
          className="font-display font-semibold text-foreground text-lg"
          id="share-link-title"
        >
          {t("title")}
        </h2>
        <p className="max-w-xl text-muted-foreground text-sm">
          {t("description")}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          checked={shareEnabled}
          disabled={updating}
          id="share-link-switch"
          onCheckedChange={handleCheckedChange}
        />
        <Label
          className="font-medium text-foreground/80 text-sm"
          htmlFor="share-link-switch"
        >
          {t("toggleLabel")}
        </Label>
      </div>
      {shareEnabled && shareToken !== null ? (
        <ShareLinkField gameId={gameId} shareToken={shareToken} />
      ) : null}
    </section>
  );
}
