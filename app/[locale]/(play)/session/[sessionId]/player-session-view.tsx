"use client";

import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const MarkdownViewer = dynamic(
  () =>
    import("@/components/game/markdown-viewer").then(
      (mod) => mod.MarkdownViewer
    ),
  { ssr: false }
);

const ClientCodeBlock = dynamic(
  () =>
    import("@/components/game/client-code-block").then(
      (mod) => mod.ClientCodeBlock
    ),
  { ssr: false }
);

import { CHOICE_SHAPES } from "@/components/session/choice-shapes";
import { CircularTimer } from "@/components/session/circular-timer";
import { Leaderboard } from "@/components/session/leaderboard";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const CHOICE_COLORS = [
  {
    bg: "bg-choice-red",
    hover: "hover:brightness-110",
    ring: "ring-choice-red/50",
  },
  {
    bg: "bg-choice-blue",
    hover: "hover:brightness-110",
    ring: "ring-choice-blue/50",
  },
  {
    bg: "bg-choice-yellow",
    hover: "hover:brightness-110",
    ring: "ring-choice-yellow/50",
  },
  {
    bg: "bg-choice-green",
    hover: "hover:brightness-110",
    ring: "ring-choice-green/50",
  },
];

interface Props {
  sessionId: string;
}

export function PlayerSessionView({ sessionId }: Props) {
  const t = useTranslations();
  const [submitting, setSubmitting] = useState(false);

  // Get participant token from localStorage
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem(`participantToken_${sessionId}`);
    setToken(stored);
  }, [sessionId]);

  // Reactive player state from Convex
  const state = useQuery(
    api.sessions.getPlayerState,
    token
      ? { sessionId: sessionId as Id<"gameSessions">, participantToken: token }
      : "skip"
  );

  // Reactive leaderboard
  const leaderboard = useQuery(api.sessions.getLeaderboard, {
    sessionId: sessionId as Id<"gameSessions">,
  });

  const submitAnswerMut = useMutation(api.sessions.submitAnswer);
  const heartbeatMut = useMutation(api.sessions.heartbeat);

  // Send heartbeat every 5s so the host knows we're still connected
  useEffect(() => {
    if (!token) return;
    // Send one immediately on mount
    heartbeatMut({ participantToken: token }).catch(() => {});
    const interval = setInterval(() => {
      heartbeatMut({ participantToken: token }).catch(() => {});
    }, 5_000);
    return () => clearInterval(interval);
  }, [token, heartbeatMut]);

  async function submitAnswer(choiceIndex: number) {
    if (submitting || !token || state?.currentAnswer) {
      return;
    }
    setSubmitting(true);
    try {
      await submitAnswerMut({
        sessionId: sessionId as Id<"gameSessions">,
        participantToken: token,
        choiceIndex,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to submit answer";
      if (!msg.includes("Already answered")) {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (token === null || state === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background bg-grid">
        <p className="font-bold font-display text-muted-foreground">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  if (!token || state === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background bg-grid">
        <p className="text-muted-foreground">
          Session not found or access denied.
        </p>
      </div>
    );
  }

  const { participant, session, currentStep, currentAnswer } = state;
  const answerRevealed = session.answerRevealed;

  // Derive correct choice index when answer is revealed
  const correctIndex =
    answerRevealed && currentStep?.choices
      ? currentStep.choices.findIndex((c) => c.isCorrect)
      : null;

  const showLeaderboard = answerRevealed && (leaderboard?.length ?? 0) > 0;

  if (session.status === "waiting") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background bg-grid p-4">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 overflow-hidden"
        >
          <div className="absolute top-1/4 left-1/3 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
          <div className="absolute right-1/4 bottom-1/4 h-48 w-48 rounded-full bg-accent/6 blur-3xl" />
        </div>
        <div className="relative space-y-2 text-center">
          <h1 className="font-black font-display text-3xl text-foreground text-glow">
            {session.gameTitle}
          </h1>
          <p className="text-muted-foreground">{t("play.waitingTitle")}</p>
        </div>
        <div className="relative flex flex-col items-center gap-3">
          <div
            aria-label="Loading"
            className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary"
            role="img"
          />
          <p className="font-bold font-display text-lg text-primary">
            {participant.name}
          </p>
        </div>
      </div>
    );
  }

  if (session.status === "finished") {
    const myEntry = leaderboard?.find((e) => e.name === participant.name);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background bg-grid p-4 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 overflow-hidden"
        >
          <div className="absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="relative space-y-3">
          <p className="text-6xl">🎉</p>
          <h1 className="font-black font-display text-3xl text-foreground">
            {t("play.finalTitle")}
          </h1>
          <p className="font-bold font-mono text-2xl text-glow text-primary">
            {t("play.finalScore", { score: participant.totalScore })}
          </p>
          {myEntry && (
            <p className="text-muted-foreground">
              {t("play.finalRank", {
                rank: myEntry.rank,
                total: leaderboard?.length ?? 0,
              })}
            </p>
          )}
        </div>
        {leaderboard && leaderboard.length > 0 && (
          <div className="surface-raised relative w-full max-w-sm p-6">
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
      <header className="flex items-center justify-between border-border border-b bg-card/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="font-bold font-display text-foreground text-sm">
            {participant.name}
          </span>
          <Badge
            className="border-primary/30 bg-primary/15 font-mono text-primary"
            variant="outline"
          >
            {participant.totalScore.toLocaleString()} pts
          </Badge>
        </div>
        <span className="font-mono text-muted-foreground text-xs">
          {session.currentStepIndex + 1} / {session.totalSteps}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
        {showLeaderboard && leaderboard && leaderboard.length > 0 && (
          <div className="surface-raised space-y-4 p-5">
            {currentAnswer && (
              <output
                aria-live="polite"
                className={cn(
                  "block rounded-xl border p-4 text-center",
                  currentAnswer.isCorrect
                    ? "border-choice-green/30 bg-choice-green/10"
                    : "border-choice-red/30 bg-choice-red/10"
                )}
              >
                <p className="font-black font-display text-foreground text-lg">
                  {currentAnswer.isCorrect
                    ? t("play.correct")
                    : t("play.incorrect")}
                </p>
                {currentAnswer.score > 0 && (
                  <p className="font-bold font-mono text-glow text-primary text-sm">
                    {t("play.pointsEarned", { points: currentAnswer.score })}
                  </p>
                )}
              </output>
            )}
            <div>
              <h3 className="mb-3 font-display text-base text-foreground">
                {t("play.leaderboardTitle")}
              </h3>
              <Leaderboard
                entries={leaderboard}
                highlightName={participant.name}
              />
            </div>
          </div>
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
                {currentStep.codeBlock && (
                  <ClientCodeBlock
                    code={currentStep.codeBlock.code}
                    language={currentStep.codeBlock.language}
                  />
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
                        stepStartedAt={new Date(
                          session.stepStartedAt
                        ).toISOString()}
                        timeLimitSeconds={currentStep.timeLimitSeconds}
                      />
                    </div>
                  )}

                <p className="font-display font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  {t("play.quizLabel")}
                </p>
                <h2 className="font-bold font-display text-foreground text-xl leading-snug">
                  {currentStep.question}
                </h2>

                {currentAnswer && !answerRevealed && (
                  <div className="flex flex-1 items-center justify-center py-8">
                    <p className="text-center text-muted-foreground text-sm">
                      {t("play.waitingReveal")}
                    </p>
                  </div>
                )}

                {answerRevealed && correctIndex !== null && currentAnswer && (
                  <output
                    aria-live="polite"
                    className={cn(
                      "block space-y-1 rounded-2xl border p-5 text-center",
                      currentAnswer.isCorrect
                        ? "border-choice-green/30 bg-choice-green/10"
                        : "border-choice-red/30 bg-choice-red/10"
                    )}
                  >
                    <p className="font-black font-display text-2xl text-foreground">
                      {currentAnswer.isCorrect
                        ? t("play.correct")
                        : t("play.incorrect")}
                    </p>
                    {currentAnswer.score > 0 && (
                      <p className="font-bold font-mono text-glow text-primary">
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
                            "relative flex min-h-[5rem] flex-col items-start justify-between rounded-2xl p-4 text-left font-semibold text-white transition-all",
                            "press-down focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            colorConfig?.bg,
                            colorConfig?.hover,
                            colorConfig?.ring,
                            submitting && "cursor-not-allowed opacity-50"
                          )}
                          disabled={submitting}
                          key={String.fromCharCode(65 + i)}
                          onClick={() => submitAnswer(i)}
                          type="button"
                        >
                          <ShapeIcon className="opacity-60" size={18} />
                          <span className="text-sm leading-tight">
                            {choice.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {answerRevealed && correctIndex !== null && (
                  <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
                    {(currentStep.choices ?? []).map((choice, i) => (
                      <li
                        aria-label={
                          i === correctIndex
                            ? `Correct: ${choice.text}`
                            : choice.text
                        }
                        className={cn(
                          "rounded-xl border-2 p-3 text-foreground text-sm",
                          i === correctIndex
                            ? "border-choice-green bg-choice-green/10 font-medium"
                            : "border-border opacity-50",
                          currentAnswer?.choiceIndex === i &&
                            i !== correctIndex &&
                            "border-choice-red bg-choice-red/10"
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
