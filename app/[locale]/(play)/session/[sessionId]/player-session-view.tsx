"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MarkdownViewer } from "@/components/game/markdown-viewer";
import { CHOICE_SHAPES } from "@/components/session/choice-shapes";
import { CircularTimer } from "@/components/session/circular-timer";
import { Leaderboard } from "@/components/session/leaderboard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSse } from "@/hooks/use-sse";
import { cn } from "@/lib/utils";

interface SessionState {
  currentAnswer: {
    choiceIndex: number;
    isCorrect: boolean;
    score: number;
  } | null;
  currentStep: {
    id: string;
    type: string;
    order: number;
    markdownContent: string | null;
    codeBlock: unknown;
    question: string | null;
    choices: Array<{ text: string; isCorrect: boolean }> | null;
    timeLimitSeconds: number | null;
  } | null;
  participant: { id: string; name: string; totalScore: number };
  session: {
    id: string;
    status: string;
    currentStepIndex: number;
    stepStartedAt: string | null;
    answerRevealed: boolean;
    totalSteps: number;
    gameTitle: string;
  };
}

interface LeaderboardEntry {
  name: string;
  rank: number;
  score: number;
}

const CHOICE_COLORS = [
  { bg: "bg-choice-red", hover: "hover:brightness-110", ring: "ring-red-300" },
  {
    bg: "bg-choice-blue",
    hover: "hover:brightness-110",
    ring: "ring-blue-300",
  },
  {
    bg: "bg-choice-yellow",
    hover: "hover:brightness-110",
    ring: "ring-yellow-300",
  },
  {
    bg: "bg-choice-green",
    hover: "hover:brightness-110",
    ring: "ring-green-300",
  },
];

interface Props {
  sessionId: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: real-time player view
export function PlayerSessionView({ sessionId }: Props) {
  const t = useTranslations();
  const [state, setState] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const sessionIdRef = useRef(sessionId);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionIdRef.current}/state`);
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useSse(sessionId, {
    step_changed: useCallback(() => {
      setCorrectIndex(null);
      setShowLeaderboard(false);
      fetchState();
    }, [fetchState]),
    answer_revealed: useCallback(
      (data: Record<string, unknown>) => {
        const { correctIndex: ci, leaderboard: lb } = data as {
          correctIndex: number;
          leaderboard: LeaderboardEntry[];
        };
        setCorrectIndex(ci);
        setLeaderboard(lb);
        setShowLeaderboard(true);
        fetchState();
      },
      [fetchState]
    ),
    session_started: useCallback(() => {
      fetchState();
    }, [fetchState]),
    session_ended: useCallback(() => {
      fetchState();
    }, [fetchState]),
  });

  async function submitAnswer(choiceIndex: number) {
    if (submitting || state?.currentAnswer) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choiceIndex }),
      });
      if (res.ok) {
        await fetchState();
      } else {
        const data = await res.json();
        if (data.error !== "Already answered") {
          toast.error("Failed to submit answer");
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-brand-radial">
        <p className="font-bold font-display text-white/70">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-brand-radial">
        <p className="text-white/70">Session not found or access denied.</p>
      </div>
    );
  }

  const { participant, session, currentStep, currentAnswer } = state;

  if (session.status === "waiting") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-brand-radial p-4">
        <div className="space-y-2 text-center">
          <h1 className="font-black font-display text-3xl text-white">
            {session.gameTitle}
          </h1>
          <p className="text-white/60">{t("play.waitingTitle")}</p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div
            aria-label="Loading"
            className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"
            role="img"
          />
          <p className="font-bold font-display text-lg text-white">
            {participant.name}
          </p>
        </div>
      </div>
    );
  }

  if (session.status === "finished") {
    const myEntry = leaderboard.find((e) => e.name === participant.name);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-brand-radial p-4 text-center">
        <div className="space-y-3">
          <p className="text-6xl">🎉</p>
          <h1 className="font-black font-display text-3xl text-white">
            {t("play.finalTitle")}
          </h1>
          <p className="font-bold font-display text-2xl text-white">
            {t("play.finalScore", { score: participant.totalScore })}
          </p>
          {myEntry && (
            <p className="text-white/60">
              {t("play.finalRank", {
                rank: myEntry.rank,
                total: leaderboard.length,
              })}
            </p>
          )}
        </div>
        {leaderboard.length > 0 && (
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <Leaderboard
              entries={leaderboard}
              highlightName={participant.name}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-border/50 border-b bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-bold font-display text-sm">
            {participant.name}
          </span>
          <Badge
            className="bg-primary/10 font-mono text-primary"
            variant="secondary"
          >
            {participant.totalScore.toLocaleString()} pts
          </Badge>
        </div>
        <span className="text-muted-foreground text-xs">
          {session.currentStepIndex + 1} / {session.totalSteps}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
        {showLeaderboard && leaderboard.length > 0 && (
          <Card className="rounded-xl border-primary/30 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display text-base">
                {t("play.leaderboardTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Leaderboard
                entries={leaderboard}
                highlightName={participant.name}
              />
            </CardContent>
          </Card>
        )}

        {!showLeaderboard && currentStep && (
          <>
            {currentStep.type === "theory" && (
              <div className="flex-1 space-y-4">
                <p className="font-display font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  {t("play.theoryLabel")}
                </p>
                {currentStep.markdownContent && (
                  <MarkdownViewer content={currentStep.markdownContent} />
                )}
              </div>
            )}

            {currentStep.type === "quiz" && (
              <div className="flex-1 space-y-5">
                {currentStep.timeLimitSeconds &&
                  session.stepStartedAt &&
                  !currentAnswer && (
                    <div className="flex justify-center">
                      <CircularTimer
                        stepStartedAt={session.stepStartedAt}
                        timeLimitSeconds={currentStep.timeLimitSeconds}
                      />
                    </div>
                  )}

                <p className="font-display font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  {t("play.quizLabel")}
                </p>
                <h2 className="font-bold font-display text-xl leading-snug">
                  {currentStep.question}
                </h2>

                {currentAnswer && !session.answerRevealed && (
                  <div className="flex flex-1 items-center justify-center py-8">
                    <p className="text-center text-muted-foreground text-sm">
                      {t("play.waitingReveal")}
                    </p>
                  </div>
                )}

                {session.answerRevealed &&
                  correctIndex !== null &&
                  currentAnswer && (
                    <output
                      aria-live="polite"
                      className={cn(
                        "block space-y-1 rounded-xl p-5 text-center",
                        currentAnswer.isCorrect
                          ? "bg-emerald-50 dark:bg-emerald-950/40"
                          : "bg-red-50 dark:bg-red-950/40"
                      )}
                    >
                      <p className="font-black font-display text-2xl">
                        {currentAnswer.isCorrect
                          ? t("play.correct")
                          : t("play.incorrect")}
                      </p>
                      {currentAnswer.score > 0 && (
                        <p className="font-bold font-display text-emerald-600 dark:text-emerald-400">
                          {t("play.pointsEarned", {
                            points: currentAnswer.score,
                          })}
                        </p>
                      )}
                    </output>
                  )}

                {!currentAnswer && (
                  <div className="grid grid-cols-2 gap-3">
                    {(currentStep.choices ?? []).map((choice, i) => {
                      const colorConfig = CHOICE_COLORS[i];
                      const ShapeIcon = CHOICE_SHAPES[i];
                      return (
                        <button
                          aria-label={`Answer ${String.fromCharCode(65 + i)}: ${choice.text}`}
                          className={cn(
                            "relative flex min-h-[5rem] flex-col items-start justify-between rounded-xl p-4 text-left font-semibold text-white transition-all",
                            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 active:scale-[0.97]",
                            colorConfig?.bg,
                            colorConfig?.hover,
                            submitting && "cursor-not-allowed opacity-50"
                          )}
                          disabled={submitting}
                          key={String.fromCharCode(65 + i)}
                          onClick={() => submitAnswer(i)}
                          type="button"
                        >
                          <ShapeIcon className="opacity-50" size={18} />
                          <span className="text-sm leading-tight">
                            {choice.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {session.answerRevealed && correctIndex !== null && (
                  <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
                    {(currentStep.choices ?? []).map((choice, i) => (
                      <li
                        aria-label={
                          i === correctIndex
                            ? `Correct: ${choice.text}`
                            : choice.text
                        }
                        className={cn(
                          "rounded-xl border-2 p-3 text-sm",
                          i === correctIndex
                            ? "border-emerald-500 bg-emerald-50 font-medium dark:bg-emerald-950/30"
                            : "border-border opacity-50",
                          currentAnswer?.choiceIndex === i &&
                            i !== correctIndex &&
                            "border-red-400 bg-red-50 dark:bg-red-950/30"
                        )}
                        key={String.fromCharCode(65 + i)}
                      >
                        <span className="mr-1 font-mono">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {choice.text}
                        {i === correctIndex && " ✓"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
