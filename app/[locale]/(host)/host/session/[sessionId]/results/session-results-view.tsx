"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { Leaderboard } from "@/components/session/leaderboard";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/routing";
import { useCachedQuery } from "@/lib/use-cached-query";

const CHOICE_BAR_COLORS = [
  "bg-choice-red",
  "bg-choice-blue",
  "bg-choice-yellow",
  "bg-choice-green",
];

interface CsvParticipant {
  _id: string;
  email?: string;
  name: string;
  totalScore: number;
}

interface CsvStep {
  _id: string;
  choices: Array<{ text: string; isCorrect: boolean }>;
  question: string;
}

interface CsvAnswer {
  choiceIndex: number;
  isCorrect: boolean;
  participantId: string;
  score: number;
  stepId: string;
}

function buildCsv(
  participants: CsvParticipant[],
  quizSteps: CsvStep[],
  answers: CsvAnswer[]
): string {
  const headers = [
    "Name",
    "Email",
    "Total Score",
    ...quizSteps.map((_s, i) => `Q${i + 1} Answer`),
    ...quizSteps.map((_s, i) => `Q${i + 1} Correct`),
    ...quizSteps.map((_s, i) => `Q${i + 1} Score`),
  ];

  const answerLookup = new Map<string, CsvAnswer>();
  for (const answer of answers) {
    answerLookup.set(`${answer.participantId}:${answer.stepId}`, answer);
  }
  const getAnswer = (
    participantId: string,
    stepId: string
  ): CsvAnswer | undefined => answerLookup.get(`${participantId}:${stepId}`);

  const rows = participants.map((p) => {
    const answerCols = quizSteps.map((step) => {
      const ans = getAnswer(p._id, step._id);
      if (!ans) {
        return "";
      }
      return step.choices[ans.choiceIndex]?.text ?? String(ans.choiceIndex);
    });
    const correctCols = quizSteps.map((step) => {
      const ans = getAnswer(p._id, step._id);
      if (!ans) {
        return "";
      }
      return ans.isCorrect ? "yes" : "no";
    });
    const scoreCols = quizSteps.map((step) => {
      const ans = getAnswer(p._id, step._id);
      return ans ? String(ans.score) : "";
    });

    return [
      p.name,
      p.email ?? "",
      String(p.totalScore),
      ...answerCols,
      ...correctCols,
      ...scoreCols,
    ];
  });

  const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(","));
  return lines.join("\n");
}

/** Results of a finished session: final leaderboard, per-question breakdown and CSV export. */
export function SessionResultsView({ sessionId }: { sessionId: string }) {
  const t = useTranslations("results");
  const results = useCachedQuery(api.sessions.getResultsView, {
    sessionId: sessionId as Id<"gameSessions">,
  });

  const handleExportCsv = useCallback(() => {
    if (!results) {
      return;
    }
    const csv = buildCsv(
      results.participants,
      results.quizSteps,
      results.answers
    );
    const csvBlob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const downloadUrl = URL.createObjectURL(csvBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `results-${sessionId}.csv`;
    document.body.append(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 100);
  }, [results, sessionId]);

  if (results === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading results&hellip;</p>
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

  const { answers, gameId, participants, quizSteps, stepCount } = results;

  const leaderboard = participants.map((p, i) => ({
    name: p.name,
    rank: i + 1,
    score: p.totalScore,
  }));

  const totalAnswered = answers.length;
  const totalCorrect = answers.filter((a) => a.isCorrect).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-semibold text-2xl text-foreground">
              {t("title")}
            </h1>
            <p className="font-mono text-muted-foreground text-sm">
              {participants.length} participants · {stepCount} steps
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="rounded-xl border-border text-foreground hover:bg-muted/50"
              disabled={!results}
              onClick={handleExportCsv}
              variant="outline"
            >
              {t("exportCSV")}
            </Button>
            <Button
              asChild
              className="rounded-xl border-border text-foreground hover:bg-muted/50"
              variant="outline"
            >
              <Link href={`/games/${gameId}/sessions`}>← Sessions</Link>
            </Button>
          </div>
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

                const choiceDistribution = step.choices.map((c, ci) => ({
                  count: stepAnswers.filter((a) => a.choiceIndex === ci).length,
                  isCorrect: c.isCorrect,
                  text: c.text,
                }));

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
                                {c.isCorrect ? " ✓" : null}
                              </span>
                              <span className="ml-auto font-mono text-muted-foreground text-xs tabular-nums">
                                {c.count}
                                <span className="sr-only">
                                  {` (${Math.round(pct)}%)`}
                                </span>
                              </span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                              <div
                                aria-hidden="true"
                                className={`h-full rounded-full transition-all ${
                                  c.isCorrect
                                    ? "bg-choice-green"
                                    : (CHOICE_BAR_COLORS[ci] ??
                                      "bg-muted-foreground/30")
                                }`}
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
