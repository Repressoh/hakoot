import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Leaderboard } from "@/components/session/leaderboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/routing";
import { getSessionResults } from "@/lib/actions/session";

interface Props {
  params: Promise<{ sessionId: string }>;
}

const CHOICE_BAR_COLORS = [
  "bg-choice-red",
  "bg-choice-blue",
  "bg-choice-yellow",
  "bg-choice-green",
];

async function ResultsContent({ sessionId }: { sessionId: string }) {
  const results = await getSessionResults(sessionId).catch(() => null);
  const t = await getTranslations("results");

  if (!results) {
    notFound();
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold font-display text-2xl">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">
            {participants.length} participants · {steps.length} steps
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/games/${session.gameId}/sessions`}>← Sessions</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-xl border-border/50 bg-white shadow-sm">
          <CardContent className="py-4 text-center">
            <p className="font-black font-display text-2xl text-primary">
              {participants.length}
            </p>
            <p className="text-muted-foreground text-xs">Participants</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/50 bg-white shadow-sm">
          <CardContent className="py-4 text-center">
            <p className="font-black font-display text-2xl text-primary">
              {quizSteps.length}
            </p>
            <p className="text-muted-foreground text-xs">Questions</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/50 bg-white shadow-sm">
          <CardContent className="py-4 text-center">
            <p className="font-black font-display text-2xl text-emerald-600">
              {totalAnswered > 0
                ? Math.round((totalCorrect / totalAnswered) * 100)
                : 0}
              %
            </p>
            <p className="text-muted-foreground text-xs">Correct Rate</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/50 bg-white shadow-sm">
          <CardContent className="py-4 text-center">
            <p className="font-black font-display text-2xl">
              {leaderboard[0]?.score.toLocaleString() ?? 0}
            </p>
            <p className="text-muted-foreground text-xs">Top Score</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="rounded-xl border-border/50 bg-white shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-display">{t("leaderboard")}</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length > 0 ? (
              <Leaderboard entries={leaderboard} />
            ) : (
              <p className="text-muted-foreground text-sm">No participants</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <h2 className="font-display font-semibold text-lg">
            {t("perQuestion")}
          </h2>
          {quizSteps.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No quiz steps in this game.
            </p>
          ) : (
            quizSteps.map((step, qi) => {
              const stepAnswers = answers.filter((a) => a.stepId === step.id);
              const stepTotal = stepAnswers.length;
              const correctCount = stepAnswers.filter(
                (a) => a.isCorrect
              ).length;

              const choiceDistribution = (step.choices ?? []).map((c, ci) => ({
                text: c.text,
                isCorrect: c.isCorrect,
                count: stepAnswers.filter((a) => a.choiceIndex === ci).length,
              }));

              return (
                <Card
                  className="rounded-xl border-border/50 bg-white shadow-sm"
                  key={step.id}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="mb-1 text-muted-foreground text-xs">
                          Q{qi + 1}
                        </p>
                        <CardTitle className="font-display font-medium text-base">
                          {step.question}
                        </CardTitle>
                      </div>
                      <div className="shrink-0 space-y-0.5 text-right">
                        <p className="font-bold font-display text-sm">
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
                  </CardHeader>
                  <CardContent>
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
                                    ? "font-medium text-emerald-700 dark:text-emerald-400"
                                    : ""
                                }
                              >
                                {c.text}
                                {c.isCorrect && " ✓"}
                              </span>
                              <span className="ml-auto text-muted-foreground text-xs tabular-nums">
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
                                    ? "bg-emerald-500"
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
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default async function SessionResultsPage({ params }: Props) {
  const { sessionId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      }
    >
      <ResultsContent sessionId={sessionId} />
    </Suspense>
  );
}
