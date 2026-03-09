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

interface Choice {
  isCorrect: boolean;
  text: string;
}

interface ChoiceGridProps {
  choices: Choice[];
  onSubmit: (index: number) => void;
  submitting: boolean;
  timerExpired: boolean;
}

function ChoiceGrid({
  choices,
  submitting,
  timerExpired,
  onSubmit,
}: ChoiceGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {choices.map((choice, i) => {
        const colorConfig = CHOICE_COLORS[i];
        const ShapeIcon = CHOICE_SHAPES[i];
        const isDisabled = submitting || timerExpired;
        return (
          <button
            aria-label={`Answer ${String.fromCharCode(65 + i)}: ${choice.text}`}
            className={cn(
              "relative flex min-h-[5rem] flex-col items-start justify-between rounded-2xl p-4 text-left font-semibold text-white transition-all",
              "press-down focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              colorConfig?.bg,
              colorConfig?.hover,
              colorConfig?.ring,
              isDisabled && "cursor-not-allowed opacity-50"
            )}
            disabled={isDisabled}
            key={String.fromCharCode(65 + i)}
            onClick={() => onSubmit(i)}
            type="button"
          >
            {ShapeIcon && <ShapeIcon className="opacity-60" size={18} />}
            <span className="text-sm leading-tight">{choice.text}</span>
          </button>
        );
      })}
    </div>
  );
}

interface RevealedChoicesProps {
  choices: Choice[];
  correctIndex: number | null | undefined;
  selectedChoiceIndex?: number;
}

function RevealedChoices({
  choices,
  correctIndex,
  selectedChoiceIndex,
}: RevealedChoicesProps) {
  if (correctIndex === null || correctIndex === undefined) {
    return null;
  }
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
      {choices.map((choice, i) => (
        <li
          aria-label={
            i === correctIndex ? `Correct: ${choice.text}` : choice.text
          }
          className={cn(
            "rounded-xl border-2 p-3 text-foreground text-sm",
            i === correctIndex
              ? "border-choice-green bg-choice-green/10 font-medium"
              : "border-border opacity-50",
            selectedChoiceIndex === i &&
              i !== correctIndex &&
              "border-choice-red bg-choice-red/10"
          )}
          key={String.fromCharCode(65 + i)}
        >
          <span className="mr-1 font-mono">{String.fromCharCode(65 + i)}.</span>
          {choice.text}
          {i === correctIndex && " ✓"}
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
        <div className="absolute top-1/4 left-1/3 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-48 w-48 rounded-full bg-accent/6 blur-3xl" />
      </div>
      <div className="relative space-y-2 text-center">
        <h1 className="font-black font-display text-3xl text-foreground text-glow">
          {gameTitle}
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

function LeaderboardPanel({
  entries,
  currentAnswer,
  participantName,
}: LeaderboardPanelProps) {
  const t = useTranslations();
  return (
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
            {currentAnswer.isCorrect ? t("play.correct") : t("play.incorrect")}
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
  onSubmit: (index: number) => void;
  question: string;
  stepStartedAt?: number;
  submitting: boolean;
  timeLimitSeconds?: number;
  timerExpired: boolean;
}

function QuizStep({
  question,
  choices,
  answerRevealed,
  correctIndex,
  currentAnswer,
  submitting,
  timerExpired,
  timeLimitSeconds,
  stepStartedAt,
  onSubmit,
}: QuizStepProps) {
  const t = useTranslations();
  return (
    <div className="flex-1 space-y-5">
      {timeLimitSeconds && stepStartedAt && !currentAnswer && (
        <div className="flex justify-center">
          <CircularTimer
            stepStartedAt={new Date(stepStartedAt).toISOString()}
            timeLimitSeconds={timeLimitSeconds}
          />
        </div>
      )}
      <p className="font-display font-semibold text-muted-foreground text-xs uppercase tracking-wide">
        {t("play.quizLabel")}
      </p>
      <h2 className="font-bold font-display text-foreground text-xl leading-snug">
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
        </output>
      )}
      {!currentAnswer && (
        <ChoiceGrid
          choices={choices}
          onSubmit={onSubmit}
          submitting={submitting}
          timerExpired={timerExpired}
        />
      )}
      {answerRevealed && correctIndex !== null && (
        <RevealedChoices
          choices={choices}
          correctIndex={correctIndex}
          selectedChoiceIndex={currentAnswer?.choiceIndex}
        />
      )}
    </div>
  );
}

type PlayerState = NonNullable<
  ReturnType<typeof useQuery<typeof api.sessions.getPlayerState>>
>;

function useStepTimerExpiry(state: PlayerState | null | undefined): boolean {
  const [timerExpired, setTimerExpired] = useState(false);

  useEffect(() => {
    setTimerExpired(false);

    const step = state?.currentStep;
    const stepStartedAt = state?.session.stepStartedAt;
    if (step?.type !== "quiz" || !step.timeLimitSeconds || !stepStartedAt) {
      return;
    }

    const timeLimitSeconds = step.timeLimitSeconds;

    const checkExpiry = () => {
      const elapsed = (Date.now() - stepStartedAt) / 1000;
      if (elapsed >= timeLimitSeconds) {
        setTimerExpired(true);
        return true;
      }
      return false;
    };

    if (checkExpiry()) {
      return;
    }
    const interval = setInterval(() => {
      if (checkExpiry()) {
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [state]);

  return timerExpired;
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
        sessionId: sessionId as Id<"gameSessions">,
        participantToken: token,
        choiceIndex,
      });
      setSubmitting(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to submit answer";
      if (!msg.includes("Already answered")) {
        toast.error(msg);
      }
      setSubmitting(false);
    }
  }

  return [submitting, submitAnswer];
}

interface SessionContentProps {
  answerRevealed: boolean;
  correctIndex: number | null;
  currentAnswer: CurrentAnswer | null | undefined;
  currentStep: {
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
  leaderboard: LeaderboardEntry[] | undefined;
  participant: { name: string; totalScore: number };
  session: {
    stepStartedAt?: number | null;
    currentStepIndex: number;
    totalSteps: number;
  };
  showLeaderboard: boolean;
  submitAnswer: (i: number) => Promise<void>;
  submitting: boolean;
  timerExpired: boolean;
}

function SessionContent({
  answerRevealed,
  correctIndex,
  currentAnswer,
  currentStep,
  leaderboard,
  participant,
  session,
  showLeaderboard,
  submitAnswer,
  submitting,
  timerExpired,
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
              <QuizStep
                answerRevealed={answerRevealed}
                choices={currentStep.choices ?? []}
                correctIndex={correctIndex}
                currentAnswer={currentAnswer}
                onSubmit={submitAnswer}
                question={currentStep.question ?? ""}
                stepStartedAt={session.stepStartedAt ?? undefined}
                submitting={submitting}
                timeLimitSeconds={currentStep.timeLimitSeconds ?? undefined}
                timerExpired={timerExpired}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export function PlayerSessionView({ sessionId }: Props) {
  const t = useTranslations();

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

  // Send heartbeat every 5s so the host knows we're still connected
  useHeartbeat(token);

  // Track whether the timer has expired on the client side
  const timerExpired = useStepTimerExpiry(state);

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
  const answerRevealed = session.answerRevealed;

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
      leaderboard={leaderboard}
      participant={participant}
      session={session}
      showLeaderboard={showLeaderboard}
      submitAnswer={submitAnswer}
      submitting={submitting}
      timerExpired={timerExpired}
    />
  );
}
