"use client";

import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CircularTimer } from "@/components/session/circular-timer";
import { InviteCodeDisplay } from "@/components/session/invite-code-display";
import { Leaderboard } from "@/components/session/leaderboard";
import { ParticipantJoinNotifier } from "@/components/session/participant-join-notifier";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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

interface SessionDoc {
  _id: Id<"gameSessions">;
  answerRevealed: boolean;
  currentStepIndex: number;
  gameId: Id<"games">;
  inviteCode: string;
  status: "waiting" | "in_progress" | "finished";
  stepStartedAt?: number;
}

interface GameDoc {
  _id: Id<"games">;
  title: string;
}

interface StepDoc {
  _id: Id<"gameSteps">;
  choices?: Array<{ text: string; isCorrect: boolean }>;
  codeBlock?: {
    code: string;
    language: string;
    annotations: Array<{ label: string; explanation: string; lines: number[] }>;
  };
  markdownContent?: string;
  order: number;
  question?: string;
  timeLimitSeconds?: number;
  type: "theory" | "quiz";
}

interface ParticipantDoc {
  _id: Id<"gameParticipants">;
  name: string;
  totalScore: number;
}

interface Props {
  data: {
    session: SessionDoc;
    game: GameDoc | null;
    steps: StepDoc[];
    participants: ParticipantDoc[];
  };
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

function StepContent({
  step,
  answerRevealed,
  answeredCount,
  participantCount,
}: StepContentProps) {
  if (step.type === "theory") {
    return (
      <>
        {step.markdownContent && (
          <MarkdownViewer content={step.markdownContent} />
        )}
        {step.codeBlock && (
          <ClientCodeBlock
            code={step.codeBlock.code}
            language={step.codeBlock.language}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-bold font-display text-foreground text-xl">
        {step.question}
      </p>
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
            {answerRevealed && choice.isCorrect && (
              <span className="ml-2 text-choice-green">✓</span>
            )}
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

function HostSessionView({ data }: Props) {
  const t = useTranslations();

  const { session, game, steps, participants } = data;
  const status = session.status;
  const currentIndex = session.currentStepIndex;
  const answerRevealed = session.answerRevealed;

  const [advancing, setAdvancing] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const advanceMut = useMutation(api.sessions.advance);
  const revealMut = useMutation(api.sessions.reveal);

  // Reactive answer count
  const answerCount = useQuery(api.sessions.getAnswerCount, {
    sessionId: session._id,
  });

  // Reactive leaderboard
  const leaderboard = useQuery(api.sessions.getLeaderboard, {
    sessionId: session._id,
  });

  const answeredCount = answerCount?.answered ?? 0;
  const participantCount = participants.length;
  const showLeaderboard = answerRevealed && (leaderboard?.length ?? 0) > 0;

  // Use useState to track current time for timer calculations
  const [now, setNow] = useState(() => Date.now());

  // Update time every second for timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Redirect on session end
  if (status === "finished") {
    redirect(`/host/session/${session._id}/results`);
  }

  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;

  async function handleAdvance() {
    setAdvancing(true);
    try {
      await advanceMut({ sessionId: session._id });
      setAdvancing(false);
    } catch {
      toast.error("Failed to advance");
      setAdvancing(false);
    }
  }

  async function handleReveal() {
    setRevealing(true);
    try {
      await revealMut({ sessionId: session._id });
      setRevealing(false);
    } catch {
      toast.error("Failed to reveal");
      setRevealing(false);
    }
  }

  const isQuiz = currentStep?.type === "quiz";
  const isLastStep = currentIndex >= steps.length - 1;

  return (
    <div className="min-h-screen bg-background">
      <ParticipantJoinNotifier participants={participants} />
      <header className="sticky top-0 z-40 border-border border-b bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <span className="font-bold font-display text-foreground">
              {game?.title}
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
          {status !== "waiting" && steps.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-muted-foreground text-sm">
                {t("session.currentStep", {
                  current: currentIndex + 1,
                  total: steps.length,
                })}
              </span>
              <Progress
                aria-label="Game progress"
                className="h-2 flex-1"
                value={((currentIndex + 1) / steps.length) * 100}
              />
            </div>
          )}

          {status === "waiting" && (
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
                  onClick={handleAdvance}
                  size="lg"
                >
                  {t("session.startSession")}
                </Button>
              </div>
            </div>
          )}

          {status === "in_progress" && currentStep && (
            <div className="surface-raised p-6">
              <div className="mb-4 flex items-center gap-2">
                <Badge
                  className={cn(
                    "text-xs",
                    currentStep.type === "theory"
                      ? "border-choice-blue/30 bg-choice-blue/15 text-choice-blue"
                      : "border-choice-yellow/30 bg-choice-yellow/15 text-choice-yellow"
                  )}
                  variant="outline"
                >
                  {currentStep.type === "theory" ? "Theory" : "Quiz"}
                </Badge>
                {currentStep.timeLimitSeconds &&
                  session.stepStartedAt &&
                  session.stepStartedAt <= now &&
                  !answerRevealed && (
                    <CircularTimer
                      stepStartedAt={session.stepStartedAt}
                      timeLimitSeconds={currentStep.timeLimitSeconds}
                    />
                  )}
                {currentStep.timeLimitSeconds && answerRevealed && (
                  <Badge
                    className="border-border bg-muted text-muted-foreground"
                    variant="outline"
                  >
                    ⏱ {currentStep.timeLimitSeconds}s
                  </Badge>
                )}
              </div>
              <div className="space-y-4">
                <StepContent
                  answeredCount={answeredCount}
                  answerRevealed={answerRevealed}
                  participantCount={participantCount}
                  step={currentStep}
                />
              </div>
            </div>
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
          <div className="surface-raised p-5">
            <h3 className="mb-3 font-display text-foreground text-sm">
              Controls
            </h3>
            <div className="space-y-2">
              {status === "in_progress" && isQuiz && !answerRevealed && (
                <Button
                  className="w-full rounded-xl border-border text-foreground hover:bg-muted/50"
                  disabled={revealing}
                  onClick={handleReveal}
                  variant="outline"
                >
                  {t("session.revealAnswer")}
                </Button>
              )}
              {status === "in_progress" && (
                <Button
                  className="glow-sm press-down w-full rounded-xl bg-primary font-bold text-primary-foreground hover:brightness-110"
                  disabled={advancing || (isQuiz && !answerRevealed)}
                  onClick={handleAdvance}
                >
                  {isLastStep ? t("session.endSession") : t("session.nextStep")}
                </Button>
              )}
            </div>
          </div>

          <ParticipantsPanel participants={participants} />
        </div>
      </div>
    </div>
  );
}

export function HostSessionPage({ sessionId }: { sessionId: string }) {
  const data = useQuery(api.sessions.getForHost, {
    sessionId: sessionId as Id<"gameSessions">,
  });

  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading session&hellip;</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Session not found</p>
      </div>
    );
  }

  return <HostSessionView data={data} />;
}
