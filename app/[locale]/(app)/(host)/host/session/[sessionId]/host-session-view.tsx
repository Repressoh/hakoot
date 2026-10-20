"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePreloadStepImage } from "@/components/game/preload-step-image";
import { StepImage } from "@/components/game/step-image";
import { usePreloadStepRenderers } from "@/components/game/use-preload-step-renderers";
import { CircularTimer } from "@/components/session/circular-timer";
import { InviteCodeDisplay } from "@/components/session/invite-code-display";
import { Leaderboard } from "@/components/session/leaderboard";
import { LinkUnavailable } from "@/components/session/link-unavailable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useHostToken } from "@/lib/host-token";
import { cn } from "@/lib/utils";

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

type HostView = NonNullable<
  FunctionReturnType<typeof api.sessions.getHostView>
>;
type SessionDoc = HostView["session"];
type StepDoc = NonNullable<HostView["currentStep"]>;
type ParticipantDoc = FunctionReturnType<
  typeof api.sessions.listHostParticipants
>[number];

interface Props {
  /** Set when the session was started from the game's share link. */
  hostToken: string | undefined;
  participants: ParticipantDoc[];
  view: HostView;
}

const CHOICE_BG = [
  "bg-choice-red text-white",
  "bg-choice-blue text-white",
  "bg-choice-yellow text-white",
  "bg-choice-green text-white",
];

function getStatusBadgeClass(
  status: "waiting" | "in_progress" | "finished"
): string {
  if (status === "in_progress") {
    return "border-choice-green/30 bg-choice-green/15 text-choice-green";
  }
  if (status === "waiting") {
    return "border-choice-yellow/30 bg-choice-yellow/15 text-choice-yellow";
  }
  return "bg-muted text-muted-foreground";
}

interface StepContentProps {
  answeredCount: number;
  answerRevealed: boolean;
  participantCount: number;
  step: StepDoc;
}

/**
 * The current step as the host sees it: its image and theory content, or the quiz question, its
 * image and the choices.
 */
function StepContent({
  step,
  answerRevealed,
  answeredCount,
  participantCount,
}: StepContentProps) {
  if (step.type === "theory") {
    return (
      <>
        {step.image ? <StepImage image={step.image} /> : null}
        {step.markdownContent ? (
          <MarkdownViewer content={step.markdownContent} />
        ) : null}
        {/* A block without code is an unfinished draft. */}
        {step.codeBlock?.code.trim() ? (
          <ClientCodeBlock
            code={step.codeBlock.code}
            language={step.codeBlock.language}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-bold font-display text-foreground text-xl">
        {step.question}
      </p>
      {step.image ? <StepImage image={step.image} maxHeight="45vh" /> : null}
      <div className="grid grid-cols-2 gap-3">
        {(step.choices ?? []).map((choice, i) => (
          <div
            className={cn(
              "rounded-2xl p-3 font-medium text-sm",
              answerRevealed && choice.isCorrect
                ? "border-2 border-choice-green bg-choice-green/10 text-foreground"
                : CHOICE_BG[i]
            )}
            key={String.fromCharCode(65 + i)}
          >
            <span className="mr-2 font-mono opacity-70">
              {String.fromCharCode(65 + i)}.
            </span>
            {choice.text}
            {answerRevealed && choice.isCorrect ? (
              <span className="ml-2 text-choice-green">✓</span>
            ) : null}
          </div>
        ))}
      </div>
      {!answerRevealed && (
        <AnswerProgress
          answeredCount={answeredCount}
          participantCount={participantCount}
        />
      )}
    </div>
  );
}

interface AnswerProgressProps {
  answeredCount: number;
  participantCount: number;
}

function AnswerProgress({
  answeredCount,
  participantCount,
}: AnswerProgressProps) {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-3 text-muted-foreground text-sm">
      <span className="font-mono">
        {t("session.answeredCount", {
          answered: answeredCount,
          total: participantCount,
        })}
      </span>
      <Progress
        aria-label="Answer progress"
        className="h-2 flex-1"
        value={participantCount ? (answeredCount / participantCount) * 100 : 0}
      />
    </div>
  );
}

interface ParticipantsPanelProps {
  participants: ParticipantDoc[];
}

/** Panel listing the session's participants, with a count. */
function ParticipantsPanel({ participants }: ParticipantsPanelProps) {
  const t = useTranslations();
  const count = participants.length;
  return (
    <div className="surface-raised p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-foreground text-sm">
          {t("session.participants")}
        </h3>
        <span className="inline-flex items-center rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-primary text-xs">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="text-muted-foreground text-xs">
          {t("session.waitingForPlayers")}
        </p>
      ) : (
        <ul aria-label="Participants list" className="space-y-1.5">
          {participants.map((p) => (
            <li
              className="flex items-center justify-between text-foreground text-sm"
              key={p._id}
            >
              <span>{p.name}</span>
              {p.totalScore > 0 && (
                <span className="font-mono text-muted-foreground text-xs">
                  {p.totalScore}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface WaitingRoomProps {
  advancing: boolean;
  onStart: () => void;
  participantCount: number;
  session: SessionDoc;
}

/** Lobby shown before the session starts: invite code, player count and the start button. */
function WaitingRoom({
  advancing,
  onStart,
  participantCount,
  session,
}: WaitingRoomProps) {
  const t = useTranslations();

  return (
    <div className="surface-raised p-6">
      <div className="space-y-6 py-10 text-center">
        <h2 className="font-display font-semibold text-2xl text-foreground">
          {t("session.waitingRoom")}
        </h2>
        <p className="text-muted-foreground">
          {t("session.participantsJoined", {
            count: participantCount,
          })}
        </p>
        <InviteCodeDisplay
          code={session.inviteCode}
          large
          sessionId={session._id}
        />
        <Button
          className="glow-primary press-down rounded-xl bg-primary px-10 font-bold font-display text-primary-foreground hover:brightness-110"
          disabled={advancing || participantCount === 0}
          onClick={onStart}
          size="lg"
        >
          {t("session.startSession")}
        </Button>
      </div>
    </div>
  );
}

interface CurrentStepCardProps {
  answeredCount: number;
  answerRevealed: boolean;
  participantCount: number;
  step: StepDoc;
  stepStartedAt?: number;
}

/**
 * Card for the step being played. Owns the 1-second clock, so only this card re-renders while the
 * timer runs.
 */
function CurrentStepCard({
  answeredCount,
  answerRevealed,
  participantCount,
  step,
  stepStartedAt,
}: CurrentStepCardProps) {
  // Track current time so the timer appears once the reading phase ends
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const timeLimitSeconds = step.timeLimitSeconds ?? 0;
  const showTimer =
    timeLimitSeconds > 0 &&
    stepStartedAt !== undefined &&
    stepStartedAt <= now &&
    !answerRevealed;

  return (
    <div className="surface-raised p-6">
      <div className="mb-4 flex items-center gap-2">
        <Badge
          className={cn(
            "text-xs",
            step.type === "theory"
              ? "border-choice-blue/30 bg-choice-blue/15 text-choice-blue"
              : "border-choice-yellow/30 bg-choice-yellow/15 text-choice-yellow"
          )}
          variant="outline"
        >
          {step.type === "theory" ? "Theory" : "Quiz"}
        </Badge>
        {showTimer ? (
          <CircularTimer
            stepStartedAt={stepStartedAt}
            timeLimitSeconds={timeLimitSeconds}
          />
        ) : null}
        {timeLimitSeconds > 0 && answerRevealed ? (
          <Badge
            className="border-border bg-muted text-muted-foreground"
            variant="outline"
          >
            ⏱ {timeLimitSeconds}s
          </Badge>
        ) : null}
      </div>
      <div className="space-y-4">
        <StepContent
          answeredCount={answeredCount}
          answerRevealed={answerRevealed}
          participantCount={participantCount}
          step={step}
        />
      </div>
    </div>
  );
}

interface HostControlsProps {
  advancing: boolean;
  answerRevealed: boolean;
  isLastStep: boolean;
  isQuiz: boolean;
  onAdvance: () => void;
  onReveal: () => void;
  revealing: boolean;
  status: SessionDoc["status"];
}

/** Host buttons to reveal the quiz answer and move to the next step (or finish on the last one). */
function HostControls({
  advancing,
  answerRevealed,
  isLastStep,
  isQuiz,
  onAdvance,
  onReveal,
  revealing,
  status,
}: HostControlsProps) {
  const t = useTranslations();

  return (
    <div className="surface-raised p-5">
      <h3 className="mb-3 font-display text-foreground text-sm">Controls</h3>
      <div className="space-y-2">
        {status === "in_progress" && isQuiz && !answerRevealed && (
          <Button
            className="w-full rounded-xl border-border text-foreground hover:bg-muted/50"
            disabled={revealing}
            onClick={onReveal}
            variant="outline"
          >
            {t("session.revealAnswer")}
          </Button>
        )}
        {status === "in_progress" && (
          <Button
            className="glow-sm press-down w-full rounded-xl bg-primary font-bold text-primary-foreground hover:brightness-110"
            disabled={advancing || (isQuiz && !answerRevealed)}
            onClick={onAdvance}
          >
            {isLastStep ? t("session.endSession") : t("session.nextStep")}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Host screen for a live session: lobby, then the current step, leaderboard and controls; redirects
 * to the results when finished.
 */
function HostSessionView({ hostToken, participants, view }: Props) {
  const t = useTranslations();

  const { currentStep, gameTitle, session, stepCount } = view;
  const { answerRevealed, currentStepIndex: currentIndex, status } = session;

  const [advancing, setAdvancing] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const advanceMut = useMutation(api.sessions.advance);
  const revealMut = useMutation(api.sessions.reveal);

  // Reactive answer count
  const answerCount = useQuery(api.sessions.getAnswerCount, {
    hostToken,
    sessionId: session._id,
  });

  // Reactive leaderboard
  const leaderboard = useQuery(api.sessions.getLeaderboard, {
    sessionId: session._id,
  });

  const answeredCount = answerCount?.answered ?? 0;
  const participantCount = participants.length;
  const showLeaderboard = answerRevealed && (leaderboard?.length ?? 0) > 0;

  // Track previous participant count for join toasts
  const prevParticipantCount = useRef(participants.length);
  useEffect(() => {
    if (participants.length > prevParticipantCount.current) {
      const newP = participants.slice(prevParticipantCount.current);
      for (const p of newP) {
        toast.info(`${p.name} joined!`);
      }
    }
    prevParticipantCount.current = participants.length;
  }, [participants]);

  // Redirect on session end
  if (status === "finished") {
    redirect(`/host/session/${session._id}/results`);
  }

  async function handleAdvance() {
    setAdvancing(true);
    try {
      await advanceMut({ hostToken, sessionId: session._id });
      setAdvancing(false);
    } catch {
      toast.error("Failed to advance");
      setAdvancing(false);
    }
  }

  async function handleReveal() {
    setRevealing(true);
    try {
      await revealMut({ hostToken, sessionId: session._id });
      setRevealing(false);
    } catch {
      toast.error("Failed to reveal");
      setRevealing(false);
    }
  }

  const isQuiz = currentStep?.type === "quiz";
  const isLastStep = currentIndex >= stepCount - 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-border border-b bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <span className="font-bold font-display text-foreground">
              {gameTitle}
            </span>
            <Badge
              className={cn("text-xs", getStatusBadgeClass(status))}
              variant="outline"
            >
              {t(`session.sessionStatus.${status}`)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {status === "waiting" && (
              <span className="font-mono text-muted-foreground text-sm">
                {t("session.participantsJoined", {
                  count: participantCount,
                })}
              </span>
            )}
            <InviteCodeDisplay
              code={session.inviteCode}
              sessionId={session._id}
            />
          </div>
        </div>
      </header>

      <div className="container mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {status !== "waiting" && stepCount > 0 && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-muted-foreground text-sm">
                {t("session.currentStep", {
                  current: currentIndex + 1,
                  total: stepCount,
                })}
              </span>
              <Progress
                aria-label="Game progress"
                className="h-2 flex-1"
                value={((currentIndex + 1) / stepCount) * 100}
              />
            </div>
          )}

          {status === "waiting" && (
            <WaitingRoom
              advancing={advancing}
              onStart={handleAdvance}
              participantCount={participantCount}
              session={session}
            />
          )}

          {status === "in_progress" && currentStep && (
            <CurrentStepCard
              answeredCount={answeredCount}
              answerRevealed={answerRevealed}
              participantCount={participantCount}
              step={currentStep}
              stepStartedAt={session.stepStartedAt}
            />
          )}

          {showLeaderboard && leaderboard && leaderboard.length > 0 && (
            <div className="surface-raised p-5">
              <h3 className="mb-3 font-display text-foreground">
                {t("play.leaderboardTitle")}
              </h3>
              <Leaderboard entries={leaderboard} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <HostControls
            advancing={advancing}
            answerRevealed={answerRevealed}
            isLastStep={isLastStep}
            isQuiz={isQuiz}
            onAdvance={handleAdvance}
            onReveal={handleReveal}
            revealing={revealing}
            status={status}
          />

          <ParticipantsPanel participants={participants} />
        </div>
      </div>
    </div>
  );
}

/** How often the lobby's participant list is re-checked for players who left. */
const LOBBY_REFRESH_MS = 5000;

/**
 * The session's participants (not loaded while `hostToken` is still being read). In the lobby the
 * query gets a `clock` that changes every LOBBY_REFRESH_MS, so players who stopped sending
 * heartbeats drop off the list (see `listHostParticipants`). Each new `clock` is a new
 * subscription with no result at first, so the previous list is returned until the new one
 * arrives.
 */
function useHostParticipants(
  sessionId: Id<"gameSessions">,
  hostToken: string | null | undefined,
  inLobby: boolean
) {
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (!inLobby) {
      return;
    }
    const interval = setInterval(
      () => setClock((c) => c + 1),
      LOBBY_REFRESH_MS
    );
    return () => clearInterval(interval);
  }, [inLobby]);

  const result = useQuery(
    api.sessions.listHostParticipants,
    hostToken === undefined
      ? "skip"
      : { clock, hostToken: hostToken ?? undefined, sessionId }
  );
  const [latest, setLatest] = useState({ result, sessionId });
  if (
    result !== undefined &&
    (result !== latest.result || sessionId !== latest.sessionId)
  ) {
    setLatest({ result, sessionId });
  }
  return result ?? (latest.sessionId === sessionId ? latest.result : undefined);
}

export function HostSessionPage({ sessionId }: { sessionId: string }) {
  // Only a session started from a share link has one; the queries wait
  // until it has been read.
  const hostToken = useHostToken(sessionId);
  const view = useQuery(
    api.sessions.getHostView,
    hostToken === undefined
      ? "skip"
      : {
          hostToken: hostToken ?? undefined,
          sessionId: sessionId as Id<"gameSessions">,
        }
  );
  const participants = useHostParticipants(
    sessionId as Id<"gameSessions">,
    hostToken,
    view?.session.status === "waiting"
  );
  usePreloadStepRenderers(view?.codeLanguages);
  usePreloadStepImage(view?.nextImageUrl);

  // Wait for both: the join toasts compare against the first participant list.
  if (view === undefined || participants === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading session&hellip;</p>
      </div>
    );
  }

  if (view === null) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* A session started from a share link closes with the link. */}
        {hostToken === null ? (
          <p className="text-muted-foreground">Session not found</p>
        ) : (
          <LinkUnavailable />
        )}
      </div>
    );
  }

  return (
    <HostSessionView
      hostToken={hostToken ?? undefined}
      participants={participants}
      view={view}
    />
  );
}
