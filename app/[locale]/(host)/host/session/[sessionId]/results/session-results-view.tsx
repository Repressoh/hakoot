"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { Leaderboard } from "@/components/session/leaderboard";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/routing";

const CHOICE_BAR_COLORS = [
  "bg-choice-red",
  "bg-choice-blue",
  "bg-choice-yellow",
  "bg-choice-green",
];

export function SessionResultsView({ sessionId }: { sessionId: string }) {
  const t = useTranslations("results");
  const results = useQuery(api.sessions.getResults, {
    sessionId: sessionId as Id<"gameSessions">,
  });

  if (results === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  if (results === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Results not found</p>
      </div>
    );
  }

  const { session, participants, answers, steps } = results;

  const leaderboard = participants.map((p, i) => ({
    rank: i + 1,
    name: p.name,
    score: p.totalScore,
  }));

  const quizSteps = steps.filter((s) => s.type === "quiz");
  const totalAnswered = answers.length;
  const totalCorrect = answers.filter((a) => a.isCorrect).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold font-display text-2xl text-foreground">
              {t("title")}
            </h1>
            <p className="font-mono text-muted-foreground text-sm">
              {participants.length} participants · {steps.length} steps
            </p>
          </div>
          <Button
            asChild
            className="rounded-xl border-border text-foreground hover:bg-muted/50"
            variant="outline"
          >
            <Link href={`/games/${session.gameId}/sessions`}>← Sessions</Link>
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="surface-raised p-4 text-center">
            <p className="font-black font-mono text-2xl text-glow text-primary">
              {participants.length}
            </p>
            <p className="text-muted-foreground text-xs">Participants</p>
          </div>
          <div className="surface-raised p-4 text-center">
            <p className="font-black font-mono text-2xl text-glow text-primary">
              {quizSteps.length}
            </p>
            <p className="text-muted-foreground text-xs">Questions</p>
          </div>
          <div className="surface-raised p-4 text-center">
            <p className="font-black font-mono text-2xl text-choice-green">
              {totalAnswered > 0
                ? Math.round((totalCorrect / totalAnswered) * 100)
                : 0}
              %
            </p>
            <p className="text-muted-foreground text-xs">Correct Rate</p>
          </div>
          <div className="surface-raised p-4 text-center">
            <p className="font-black font-mono text-2xl text-foreground">
              {leaderboard[0]?.score.toLocaleString() ?? 0}
            </p>
            <p className="text-muted-foreground text-xs">Top Score</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Leaderboard */}
          <div className="surface-raised p-5">
            <h2 className="mb-3 font-display text-foreground">
              {t("leaderboard")}
            </h2>
            {leaderboard.length > 0 ? (
              <Leaderboard entries={leaderboard} />
            ) : (
              <p className="text-muted-foreground text-sm">No participants</p>
            )}
          </div>

          {/* Per-question breakdown */}
          <div className="space-y-4 lg:col-span-2">
            <h2 className="font-display font-semibold text-foreground text-lg">
              {t("perQuestion")}
            </h2>
            {quizSteps.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No quiz steps in this game.
              </p>
            ) : (
              quizSteps.map((step, qi) => {
                const stepAnswers = answers.filter(
                  (a) => a.stepId === step._id
                );
                const stepTotal = stepAnswers.length;
                const correctCount = stepAnswers.filter(
                  (a) => a.isCorrect
                ).length;

                const choiceDistribution = (step.choices ?? []).map(
                  (c, ci) => ({
                    text: c.text,
                    isCorrect: c.isCorrect,
                    count: stepAnswers.filter((a) => a.choiceIndex === ci)
                      .length,
                  })
                );

                return (
                  <div className="surface-raised p-5" key={step._id}>
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div>
                        <p className="mb-1 font-mono text-muted-foreground text-xs">
                          Q{qi + 1}
                        </p>
                        <h3 className="font-display font-medium text-base text-foreground">
                          {step.question}
                        </h3>
                      </div>
                      <div className="shrink-0 space-y-0.5 text-right">
                        <p className="font-bold font-mono text-foreground text-sm">
                          {stepTotal > 0
                            ? Math.round((correctCount / stepTotal) * 100)
                            : 0}
                          %{" "}
                          <span className="font-normal text-muted-foreground text-xs">
                            correct
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {choiceDistribution.map((c, ci) => {
                        const pct =
                          stepTotal > 0 ? (c.count / stepTotal) * 100 : 0;
                        return (
                          // biome-ignore lint/suspicious/noArrayIndexKey: fixed choice positions
                          <div className="space-y-1" key={ci}>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="w-5 font-mono text-muted-foreground">
                                {String.fromCharCode(65 + ci)}
                              </span>
                              <span
                                className={
                                  c.isCorrect
                                    ? "font-medium text-choice-green"
                                    : "text-foreground"
                                }
                              >
                                {c.text}
                                {c.isCorrect && " ✓"}
                              </span>
                              <span className="ml-auto font-mono text-muted-foreground text-xs tabular-nums">
                                {c.count}
                              </span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                              <div
                                aria-label={`${Math.round(pct)}% chose ${c.text}`}
                                aria-valuemax={100}
                                aria-valuemin={0}
                                aria-valuenow={pct}
                                className={`h-full rounded-full transition-all ${
                                  c.isCorrect
                                    ? "bg-choice-green"
                                    : (CHOICE_BAR_COLORS[ci] ??
                                      "bg-muted-foreground/30")
                                }`}
                                role="progressbar"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
