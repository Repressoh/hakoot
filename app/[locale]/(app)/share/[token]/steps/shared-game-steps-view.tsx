"use client";

import { usePaginatedQuery, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { usePreloadStepRenderers } from "@/components/game/use-preload-step-renderers";
import { LinkUnavailable } from "@/components/session/link-unavailable";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/routing";
import { SharedGameSteps } from "../shared-game-steps";

/** Public reader. The only step controls select what to read or load more steps. */
export function SharedGameStepsView({ shareToken }: { shareToken: string }) {
  const t = useTranslations("sharing");
  const game = useQuery(api.sharing.getSharedGame, { shareToken });
  const { results, status, loadMore } = usePaginatedQuery(
    api.sharing.getSharedGameSteps,
    { shareToken },
    { initialNumItems: 10 }
  );
  usePreloadStepRenderers(
    game === null
      ? undefined
      : results.flatMap((step) =>
          step.codeBlock ? [step.codeBlock.language] : []
        )
  );

  return (
    <div className="space-y-8">
      <Link
        className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
        href={`/share/${shareToken}`}
      >
        <span aria-hidden="true">←</span>
        {t("backToGame")}
      </Link>
      {game === undefined ? (
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : null}
      {game === null ? (
        <div className="mx-auto max-w-md">
          <LinkUnavailable />
        </div>
      ) : null}
      {game ? (
        <>
          <header className="max-w-3xl space-y-2">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {t("pageTitle")}
            </p>
            <h1 className="wrap-anywhere font-display font-semibold text-2xl text-foreground sm:text-3xl">
              {game.title}
            </h1>
            {game.description ? (
              <p className="wrap-anywhere whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
                {game.description}
              </p>
            ) : null}
          </header>
          <SharedGameSteps
            key={shareToken}
            onLoadMore={() => loadMore(10)}
            status={status}
            stepCount={game.stepCount}
            steps={results}
          />
        </>
      ) : null}
    </div>
  );
}
