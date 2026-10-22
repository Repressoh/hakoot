"use client";

import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { LinkUnavailable } from "@/components/session/link-unavailable";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { Link, useRouter } from "@/i18n/routing";
import { saveHostToken } from "@/lib/host-token";
import { SharedGameSteps } from "./shared-game-steps";

interface ShareTokenProps {
  shareToken: string;
}

function SharedGameSkeleton() {
  return (
    <div className="surface-raised mx-auto w-full max-w-md space-y-6 p-8">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-3 w-24 rounded-sm" />
        <Skeleton className="h-7 w-56 rounded-md" />
        <Skeleton className="h-4 w-64 rounded-md" />
        <Skeleton className="h-6 w-40 rounded-lg" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

/** Starts a session from the share link and opens its host screen. */
function HostSharedGame({ shareToken }: ShareTokenProps) {
  const t = useTranslations("sharing");
  const { push } = useRouter();
  const hostSharedGame = useMutation(api.sharing.hostSharedGame);
  const [starting, setStarting] = useState(false);

  async function handleHost() {
    setStarting(true);
    try {
      const { hostToken, sessionId } = await hostSharedGame({ shareToken });
      if (hostToken !== null) {
        saveHostToken(sessionId, hostToken);
      }
      push(`/host/session/${sessionId}`);
    } catch {
      toast.error(t("hostFailed"));
      setStarting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        className="glow-primary press-down h-12 w-full rounded-xl bg-primary font-bold font-display text-base text-primary-foreground hover:brightness-110"
        disabled={starting}
        onClick={handleHost}
      >
        {t("hostGame")}
      </Button>
      <p className="text-center text-muted-foreground text-xs">
        {t("hostHint")}
      </p>
    </div>
  );
}

/** Copies the game into the signed-in user's games; asks anyone else to sign in first. */
function CopySharedGame({ shareToken }: ShareTokenProps) {
  const t = useTranslations("sharing");
  const { push } = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const copySharedGame = useMutation(api.sharing.copySharedGame);
  const [copying, setCopying] = useState(false);

  async function handleCopy() {
    setCopying(true);
    try {
      const gameId = await copySharedGame({ shareToken });
      toast.success(t("copySuccess"));
      push(`/games/${gameId}`);
    } catch {
      toast.error(t("copyFailed"));
      setCopying(false);
    }
  }

  const buttonClassName =
    "press-down h-11 w-full rounded-xl border-border bg-transparent font-semibold text-foreground hover:bg-muted/50";

  return (
    <div className="space-y-2">
      {isLoading || isAuthenticated ? (
        <Button
          className={buttonClassName}
          disabled={isLoading || copying}
          onClick={handleCopy}
          variant="outline"
        >
          {t("copyGame")}
        </Button>
      ) : (
        <Button asChild className={buttonClassName} variant="outline">
          <Link
            href={`/sign-in?${new URLSearchParams({ next: `/share/${shareToken}` })}`}
          >
            {t("signInToCopy")}
          </Link>
        </Button>
      )}
      <p className="text-center text-muted-foreground text-xs">
        {t("copyHint")}
      </p>
    </div>
  );
}

/** The shared game and its read-only steps, with actions to host or copy it. */
export function SharedGameView({ shareToken }: ShareTokenProps) {
  const t = useTranslations("sharing");
  const tDashboard = useTranslations("dashboard");
  const game = useQuery(api.sharing.getSharedGame, { shareToken });
  const { results, status, loadMore } = usePaginatedQuery(
    api.sharing.getSharedGameSteps,
    { shareToken },
    { initialNumItems: 10 }
  );

  if (game === undefined) {
    return <SharedGameSkeleton />;
  }

  if (game === null) {
    return (
      <div className="mx-auto max-w-md">
        <LinkUnavailable />
      </div>
    );
  }

  return (
    <>
      <div className="surface-raised mx-auto max-w-md space-y-6 p-8">
        <div className="space-y-2 text-center">
          <p className="font-display font-semibold text-muted-foreground text-xs uppercase tracking-wide">
            {t("pageTitle")}
          </p>
          <h1 className="font-display font-semibold text-2xl text-foreground">
            {game.title}
          </h1>
          {game.description ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {game.description}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="rounded-lg bg-muted/60 px-2.5 py-1 font-mono text-muted-foreground text-xs">
              {tDashboard("steps", { count: game.stepCount })}
            </span>
            <span className="rounded-lg bg-muted/60 px-2.5 py-1 font-mono text-muted-foreground text-xs">
              {t("quizCount", { count: game.quizCount })}
            </span>
          </div>
        </div>

        <HostSharedGame shareToken={shareToken} />
        <Separator className="bg-border/60" />
        <CopySharedGame shareToken={shareToken} />
      </div>
      <SharedGameSteps
        onLoadMore={() => loadMore(10)}
        status={status}
        stepCount={game.stepCount}
        steps={results}
      />
    </>
  );
}
