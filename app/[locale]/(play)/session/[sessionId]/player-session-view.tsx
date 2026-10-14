"use client";

import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

/**
 * Seeded LCG (Linear Congruential Generator) PRNG.
 * Uses only arithmetic operators (+, *, %) — no bitwise ops.
 * Parameters from Numerical Recipes: m=2^31, a=1664525, c=1013904223.
 */
function lcgRng(seed: number): () => number {
  let s = Math.abs(seed) % 2_147_483_647;
  return () => {
    s = (1_664_525 * s + 1_013_904_223) % 2_147_483_648;
    return s / 2_147_483_648;
  };
}

/** Hash a string to a non-negative integer using only + and * operators */
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) % 2_147_483_647;
  }
  return h;
}

/**
 * Returns a shuffled array of {choice, originalIndex} pairs
 * deterministically based on token + stepId seed.
 */
function shuffleChoices(
  choices: Choice[],
  token: string,
  stepId: string
): Array<{ choice: Choice; originalIndex: number }> {
  const seed = hashString(`${token}:${stepId}`);
  const rng = lcgRng(seed);
  const arr = choices.map((choice, originalIndex) => ({
    choice,
    originalIndex,
  }));
  // Fisher-Yates shuffle
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j] as (typeof arr)[0], arr[i] as (typeof arr)[0]];
  }
  return arr;
}

interface Choice {
  isCorrect: boolean;
  text: string;
}

interface ChoiceGridProps {
  onSubmit: (originalIndex: number) => void;
  shuffledChoices: Array<{ choice: Choice; originalIndex: number }>;
  submitting: boolean;
  timerExpired: boolean;
}

/** Grid of answer buttons for a quiz step; disabled while submitting or once time is up. */
function ChoiceGrid({
  shuffledChoices,
  submitting,
  timerExpired,
  onSubmit,
}: ChoiceGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {shuffledChoices.map(({ choice, originalIndex }, displayIndex) => {
        const colorConfig = CHOICE_COLORS[displayIndex];
        const ShapeIcon = CHOICE_SHAPES[displayIndex];
        const isDisabled = submitting || timerExpired;
        return (
          <button
            aria-label={`Answer ${String.fromCharCode(65 + displayIndex)}: ${choice.text}`}
            className={cn(
              "relative flex min-h-[5rem] flex-col items-start justify-between rounded-2xl p-4 text-left font-semibold text-white transition-all",
              "press-down focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              colorConfig?.bg,
              colorConfig?.hover,
              colorConfig?.ring,
              isDisabled && "cursor-not-allowed opacity-50"
            )}
            disabled={isDisabled}
            key={String.fromCharCode(65 + displayIndex)}
            onClick={() => onSubmit(originalIndex)}
            type="button"
          >
            {ShapeIcon ? <ShapeIcon className="opacity-60" size={18} /> : null}
            <span className="text-sm leading-tight">{choice.text}</span>
          </button>
        );
      })}
    </div>
  );
}

interface RevealedChoicesProps {
  correctIndex: number | null | undefined;
  selectedChoiceIndex?: number;
  shuffledChoices: Array<{ choice: Choice; originalIndex: number }>;
}

function RevealedChoices({
  shuffledChoices,
  correctIndex,
  selectedChoiceIndex,
}: RevealedChoicesProps) {
  if (correctIndex === null || correctIndex === undefined) {
    return null;
  }
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
      {shuffledChoices.map(({ choice, originalIndex }, displayIndex) => (
        <li
          aria-label={
            originalIndex === correctIndex
              ? `Correct: ${choice.text}`
              : choice.text
          }
          className={cn(
            "rounded-xl border-2 p-3 text-foreground text-sm",
            originalIndex === correctIndex
              ? "border-choice-green bg-choice-green/10 font-medium"
              : "border-border opacity-50",
            selectedChoiceIndex === originalIndex &&
              originalIndex !== correctIndex &&
              "border-choice-red bg-choice-red/10"
          )}
          key={String.fromCharCode(65 + displayIndex)}
        >
          <span className="mr-1 font-mono">
            {String.fromCharCode(65 + displayIndex)}.
          </span>
          {choice.text}
          {originalIndex === correctIndex && " ✓"}
        </li>
      ))}
    </ul>
  );
}

interface Props {
  sessionId: string;
}

interface Participant {
  name: string;
  totalScore: number;
}

interface WaitingScreenProps {
  gameTitle: string;
  participantName: string;
}

function WaitingScreen({ gameTitle, participantName }: WaitingScreenProps) {
  const t = useTranslations();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background bg-grid p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute top-1/4 left-1/3 size-72 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 size-48 rounded-full bg-accent/6 blur-3xl" />
      </div>
      <div className="relative space-y-2 text-center">
        <h1 className="font-display font-semibold text-3xl text-foreground text-glow">
          {gameTitle}
        </h1>
        <p className="text-muted-foreground">{t("play.waitingTitle")}</p>
      </div>
      <div className="relative flex flex-col items-center gap-3">
        <div
          aria-label="Loading"
          className="size-10 animate-spin rounded-full border-4 border-border border-t-primary"
          role="img"
        />
        <p className="font-bold font-display text-lg text-primary">
          {participantName}
        </p>
      </div>
    </div>
  );
}

interface LeaderboardEntry {
  name: string;
  rank: number;
  score: number;
}

interface FinishedScreenProps {
  leaderboard: LeaderboardEntry[] | undefined;
  participant: Participant;
}

function FinishedScreen({ participant, leaderboard }: FinishedScreenProps) {
  const t = useTranslations();
  const myEntry = leaderboard?.find((e) => e.name === participant.name);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background bg-grid p-4 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute top-1/3 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="relative space-y-3">
        <p className="text-6xl">🎉</p>
        <h1 className="font-display font-semibold text-3xl text-foreground">
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
          <Leaderboard entries={leaderboard} highlightName={participant.name} />
        </div>
      )}
    </div>
  );
}

interface CurrentAnswer {
  choiceIndex: number;
  isCorrect: boolean;
  score: number;
}

interface LeaderboardPanelProps {
  currentAnswer?: CurrentAnswer | null;
  entries: LeaderboardEntry[];
  participantName: string;
}

/** Leaderboard shown between steps, with the player's result for the last question. */
function LeaderboardPanel({
  entries,
  currentAnswer,
  participantName,
}: LeaderboardPanelProps) {
  const t = useTranslations();
  return (
    <div className="surface-raised space-y-4 p-5">
      {currentAnswer ? (
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
            {currentAnswer.isCorrect ? t("play.correct") : t("play.incorrect")}
          </p>
          {currentAnswer.score > 0 && (
            <p className="font-bold font-mono text-glow text-primary text-sm">
              {t("play.pointsEarned", { points: currentAnswer.score })}
            </p>
          )}
          {!currentAnswer.isCorrect && currentAnswer.score < 0 && (
            <p className="font-bold font-mono text-destructive text-sm">
              {currentAnswer.score} pts
            </p>
          )}
        </output>
      ) : null}
      <div>
        <h3 className="mb-3 font-display text-base text-foreground">
          {t("play.leaderboardTitle")}
        </h3>
        <Leaderboard entries={entries} highlightName={participantName} />
      </div>
    </div>
  );
}

interface QuizStepProps {
  answerRevealed: boolean;
  choices: Choice[];
  correctIndex: number | null | undefined;
  currentAnswer?: CurrentAnswer | null;
  isReading: boolean;
  onSubmit: (index: number) => void;
  question: string;
  readingSecondsLeft: number;
  stepId: string;
  stepStartedAt?: number;
  submitting: boolean;
  timeLimitSeconds?: number;
  timerExpired: boolean;
  token: string;
}

/** Countdown for the answer window; hidden during the reading phase. */
function QuizTimer({
  hidden,
  stepStartedAt,
  timeLimitSeconds,
}: {
  hidden: boolean;
  stepStartedAt?: number;
  timeLimitSeconds?: number;
}) {
  if (hidden || !timeLimitSeconds || !stepStartedAt) {
    return null;
  }
  return (
    <div className="flex justify-center">
      <CircularTimer
        stepStartedAt={stepStartedAt}
        timeLimitSeconds={timeLimitSeconds}
      />
    </div>
  );
}

/** Seconds left in the reading phase before answers open. */
function ReadingCountdown({ secondsLeft }: { secondsLeft: number }) {
  return (
    <div className="flex justify-center">
      <div
        aria-label={`${secondsLeft} seconds to read`}
        className="flex size-20 flex-col items-center justify-center rounded-full border-4 border-primary/30 bg-primary/10"
        role="timer"
      >
        <span className="font-bold font-display text-2xl text-primary">
          {secondsLeft}
        </span>
        <span className="text-muted-foreground text-xs">read</span>
      </div>
    </div>
  );
}

/** Announces whether the player's answer was correct and the points earned. */
function AnswerResult({ currentAnswer }: { currentAnswer: CurrentAnswer }) {
  const t = useTranslations();

  return (
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
        {currentAnswer.isCorrect ? t("play.correct") : t("play.incorrect")}
      </p>
      {currentAnswer.score > 0 && (
        <p className="font-bold font-mono text-glow text-primary">
          {t("play.pointsEarned", { points: currentAnswer.score })}
        </p>
      )}
      {!currentAnswer.isCorrect && currentAnswer.score < 0 && (
        <p className="font-bold font-mono text-destructive">
          {currentAnswer.score} pts
        </p>
      )}
    </output>
  );
}

/**
 * A quiz step for the player: question, reading countdown or timer, answer choices and the result
 * once revealed.
 */
function QuizStep({
  question,
  choices,
  answerRevealed,
  correctIndex,
  currentAnswer,
  isReading,
  readingSecondsLeft,
  submitting,
  timerExpired,
  timeLimitSeconds,
  stepStartedAt,
  stepId,
  token,
  onSubmit,
}: QuizStepProps) {
  const t = useTranslations();

  // Stable shuffle per (token, stepId) — recalculates only when the step changes.
  // choices is stable for a given stepId so including it doesn't cause extra recalculations.
  const shuffledChoices = useMemo(
    () => shuffleChoices(choices, token, stepId),
    [choices, token, stepId]
  );

  return (
    <div className="flex-1 space-y-5">
      <QuizTimer
        hidden={Boolean(currentAnswer) || isReading}
        stepStartedAt={stepStartedAt}
        timeLimitSeconds={timeLimitSeconds}
      />
      {isReading ? <ReadingCountdown secondsLeft={readingSecondsLeft} /> : null}
      <p className="font-display font-semibold text-muted-foreground text-xs uppercase tracking-wide">
        {t("play.quizLabel")}
      </p>
      <h2 className="font-display font-semibold text-foreground text-xl leading-snug">
        {question}
      </h2>
      {currentAnswer && !answerRevealed && (
        <div className="flex flex-1 items-center justify-center py-8">
          <p className="text-center text-muted-foreground text-sm">
            {t("play.waitingReveal")}
          </p>
        </div>
      )}
      {answerRevealed && correctIndex !== null && currentAnswer && (
        <AnswerResult currentAnswer={currentAnswer} />
      )}
      {!(currentAnswer || isReading) && (
        <ChoiceGrid
          onSubmit={onSubmit}
          shuffledChoices={shuffledChoices}
          submitting={submitting}
          timerExpired={timerExpired}
        />
      )}
      {answerRevealed && correctIndex !== null && (
        <RevealedChoices
          correctIndex={correctIndex}
          selectedChoiceIndex={currentAnswer?.choiceIndex}
          shuffledChoices={shuffledChoices}
        />
      )}
    </div>
  );
}

type PlayerState = NonNullable<
  ReturnType<typeof useQuery<typeof api.sessions.getPlayerState>>
>;

/** Returns true while we're in the reading phase (stepStartedAt is in the future) */
function useReadingPhase(state: PlayerState | null | undefined): {
  isReading: boolean;
  readingSecondsLeft: number;
} {
  const stepStartedAt = state?.session.stepStartedAt;
  const step = state?.currentStep;
  const isQuizWithTimer =
    step?.type === "quiz" && Boolean(step.timeLimitSeconds) && stepStartedAt;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isQuizWithTimer) {
      return;
    }
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= (stepStartedAt ?? 0)) {
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isQuizWithTimer, stepStartedAt]);

  if (!(isQuizWithTimer && stepStartedAt)) {
    return { isReading: false, readingSecondsLeft: 0 };
  }

  const remaining = stepStartedAt - now;
  if (remaining <= 0) {
    return { isReading: false, readingSecondsLeft: 0 };
  }
  return { isReading: true, readingSecondsLeft: Math.ceil(remaining / 1000) };
}

/**
 * Whether the current quiz step's time limit has passed. Schedules a single timeout at the deadline
 * instead of polling.
 */
function useStepTimerExpiry(state: PlayerState | null | undefined): boolean {
  const step = state?.currentStep;
  const stepStartedAt = state?.session.stepStartedAt;
  const deadline =
    step?.type === "quiz" && step.timeLimitSeconds && stepStartedAt
      ? stepStartedAt + step.timeLimitSeconds * 1000
      : null;

  // Wall-clock time of the last deadline check (0 = not checked yet).
  const [checkedAt, setCheckedAt] = useState(0);

  useEffect(() => {
    if (deadline === null || checkedAt >= deadline) {
      return;
    }
    // Check again once the deadline should have passed; re-arms if it fires early.
    const timeout = setTimeout(
      () => setCheckedAt(Date.now()),
      Math.max(0, deadline - Date.now())
    );
    return () => clearTimeout(timeout);
  }, [checkedAt, deadline]);

  return deadline !== null && checkedAt >= deadline;
}

function useHeartbeat(token: string | null): void {
  const heartbeatMut = useMutation(api.sessions.heartbeat);
  useEffect(() => {
    if (!token) {
      return;
    }
    heartbeatMut({ participantToken: token }).catch(() => {
      // Ignore heartbeat errors
    });
    const interval = setInterval(() => {
      heartbeatMut({ participantToken: token }).catch(() => {
        // Ignore heartbeat errors
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [token, heartbeatMut]);
}

/**
 * Returns `[submitting, submitAnswer]`; `submitAnswer` does nothing once the player has answered or
 * time is up.
 */
function useSubmitAnswer(
  sessionId: string,
  token: string | null,
  hasCurrentAnswer: boolean,
  timerExpired: boolean
): [boolean, (choiceIndex: number) => Promise<void>] {
  const [submitting, setSubmitting] = useState(false);
  const submitAnswerMut = useMutation(api.sessions.submitAnswer);

  async function submitAnswer(choiceIndex: number) {
    if (submitting || !token || hasCurrentAnswer || timerExpired) {
      return;
    }
    setSubmitting(true);
    try {
      await submitAnswerMut({
        choiceIndex,
        participantToken: token,
        sessionId: sessionId as Id<"gameSessions">,
      });
      setSubmitting(false);
    } catch (e) {
      setSubmitting(false);
      const msg = e instanceof Error ? e.message : "Failed to submit answer";
      if (!msg.includes("Already answered")) {
        toast.error(msg);
      }
    }
  }

  return [submitting, submitAnswer];
}

interface SessionContentProps {
  answerRevealed: boolean;
  correctIndex: number | null;
  currentAnswer: CurrentAnswer | null | undefined;
  currentStep: {
    id: string;
    type: string;
    choices?: Choice[] | null;
    question?: string | null;
    markdownContent?: string | null;
    codeBlock?: {
      code: string;
      language: string;
      annotations?: unknown[];
    } | null;
    timeLimitSeconds?: number | null;
  } | null;
  isReading: boolean;
  leaderboard: LeaderboardEntry[] | undefined;
  participant: { name: string; totalScore: number };
  readingSecondsLeft: number;
  session: {
    stepStartedAt?: number | null;
    currentStepIndex: number;
    totalSteps: number;
  };
  showLeaderboard: boolean;
  submitAnswer: (i: number) => Promise<void>;
  submitting: boolean;
  timerExpired: boolean;
  token: string;
}

/**
 * Player screen during a session: header with name and score, then the current step or the
 * leaderboard.
 */
function SessionContent({
  answerRevealed,
  correctIndex,
  currentAnswer,
  currentStep,
  isReading,
  leaderboard,
  participant,
  readingSecondsLeft,
  session,
  showLeaderboard,
  submitAnswer,
  submitting,
  timerExpired,
  token,
}: SessionContentProps) {
  const t = useTranslations();
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
          <LeaderboardPanel
            currentAnswer={currentAnswer}
            entries={leaderboard}
            participantName={participant.name}
          />
        )}

        {!showLeaderboard && currentStep && (
          <>
            {currentStep.type === "theory" && (
              <div className="flex-1 space-y-4">
                <p className="font-display font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  {t("play.theoryLabel")}
                </p>
                {currentStep.markdownContent ? (
                  <MarkdownViewer content={currentStep.markdownContent} />
                ) : null}
                {currentStep.codeBlock ? (
                  <ClientCodeBlock
                    code={currentStep.codeBlock.code}
                    language={currentStep.codeBlock.language}
                  />
                ) : null}
              </div>
            )}

            {currentStep.type === "quiz" && (
              <QuizStep
                answerRevealed={answerRevealed}
                choices={currentStep.choices ?? []}
                correctIndex={correctIndex}
                currentAnswer={currentAnswer}
                isReading={isReading}
                onSubmit={submitAnswer}
                question={currentStep.question ?? ""}
                readingSecondsLeft={readingSecondsLeft}
                stepId={currentStep.id}
                stepStartedAt={session.stepStartedAt ?? undefined}
                submitting={submitting}
                timeLimitSeconds={currentStep.timeLimitSeconds ?? undefined}
                timerExpired={timerExpired}
                token={token}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

/** Player view of a live session, identified by the participant token saved in localStorage. */
export function PlayerSessionView({ sessionId }: Props) {
  const t = useTranslations();

  // Get participant token from localStorage — useSyncExternalStore avoids an
  // effect-based setState and handles SSR (returns null on the server).
  const token = useSyncExternalStore(
    (onStoreChange: () => void) => {
      // Storage events fire when another tab changes localStorage; re-subscribe
      // when sessionId changes by returning a no-op unsubscribe.
      window.addEventListener("storage", onStoreChange);
      return () => window.removeEventListener("storage", onStoreChange);
    },
    () => localStorage.getItem(`participantToken_${sessionId}`),
    () => null
  );

  // Reactive player state from Convex
  const state = useQuery(
    api.sessions.getPlayerState,
    token
      ? { participantToken: token, sessionId: sessionId as Id<"gameSessions"> }
      : "skip"
  );

  // Reactive leaderboard
  const leaderboard = useQuery(api.sessions.getLeaderboard, {
    sessionId: sessionId as Id<"gameSessions">,
  });

  // Send heartbeat every 5s so the host knows we're still connected
  useHeartbeat(token);

  // Track whether the timer has expired on the client side
  const timerExpired = useStepTimerExpiry(state);

  // Track reading phase (10s before choices appear)
  const { isReading, readingSecondsLeft } = useReadingPhase(state);

  const hasCurrentAnswer = Boolean(state?.currentAnswer);
  const [submitting, submitAnswer] = useSubmitAnswer(
    sessionId,
    token,
    hasCurrentAnswer,
    timerExpired
  );

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
  const { answerRevealed } = session;

  // Derive correct choice index when answer is revealed
  const correctIndex = (() => {
    if (!(answerRevealed && currentStep?.choices)) {
      return null;
    }
    const idx = currentStep.choices.findIndex((c) => c.isCorrect);
    return idx >= 0 ? idx : null;
  })();

  const showLeaderboard = answerRevealed && (leaderboard?.length ?? 0) > 0;

  if (session.status === "waiting") {
    return (
      <WaitingScreen
        gameTitle={session.gameTitle}
        participantName={participant.name}
      />
    );
  }

  if (session.status === "finished") {
    return (
      <FinishedScreen leaderboard={leaderboard} participant={participant} />
    );
  }

  return (
    <SessionContent
      answerRevealed={answerRevealed}
      correctIndex={correctIndex}
      currentAnswer={currentAnswer}
      currentStep={currentStep}
      isReading={isReading}
      leaderboard={leaderboard}
      participant={participant}
      readingSecondsLeft={readingSecondsLeft}
      session={session}
      showLeaderboard={showLeaderboard}
      submitAnswer={submitAnswer}
      submitting={submitting}
      timerExpired={timerExpired}
      token={token}
    />
  );
}
