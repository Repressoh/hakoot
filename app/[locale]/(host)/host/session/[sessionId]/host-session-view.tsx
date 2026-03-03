"use client";

import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MarkdownViewer } from "@/components/game/markdown-viewer";
import { InviteCodeDisplay } from "@/components/session/invite-code-display";
import { Leaderboard } from "@/components/session/leaderboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link, useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";

interface SessionDoc {
  _id: Id<"gameSessions">;
  gameId: Id<"games">;
  inviteCode: string;
  status: "waiting" | "in_progress" | "finished";
  currentStepIndex: number;
  answerRevealed: boolean;
}

interface GameDoc {
  _id: Id<"games">;
  title: string;
}

interface StepDoc {
  _id: Id<"gameSteps">;
  type: "theory" | "quiz";
  order: number;
  markdownContent?: string;
  codeBlock?: { code: string; language: string; annotations: Array<{ label: string; explanation: string; lines: number[] }> };
  question?: string;
  choices?: Array<{ text: string; isCorrect: boolean }>;
  timeLimitSeconds?: number;
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

export function HostSessionView({ data }: Props) {
  const t = useTranslations();
  const router = useRouter();

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
  useEffect(() => {
    if (status === "finished") {
      router.push(`/host/session/${session._id}/results`);
    }
  }, [status, session._id, router]);

  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;

  async function handleAdvance() {
    setAdvancing(true);
    try {
      await advanceMut({ sessionId: session._id });
    } catch {
      toast.error("Failed to advance");
    } finally {
      setAdvancing(false);
    }
  }

  async function handleReveal() {
    setRevealing(true);
    try {
      await revealMut({ sessionId: session._id });
    } catch {
      toast.error("Failed to reveal");
    } finally {
      setRevealing(false);
    }
  }

  const isQuiz = currentStep?.type === "quiz";
  const isLastStep = currentIndex >= steps.length - 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <span className="font-bold font-display text-foreground">{game?.title}</span>
            <Badge
              className={cn(
                "text-xs",
                status === "in_progress"
                  ? "bg-choice-green/15 text-choice-green border-choice-green/30"
                  : status === "waiting"
                    ? "bg-choice-yellow/15 text-choice-yellow border-choice-yellow/30"
                    : "bg-muted text-muted-foreground"
              )}
              variant="outline"
            >
              {t(`session.sessionStatus.${status}`)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {status === "waiting" && (
              <span className="text-muted-foreground text-sm font-mono">
                {t("session.participantsJoined", {
                  count: participantCount,
                })}
              </span>
            )}
            {status !== "finished" && (
              <InviteCodeDisplay
                code={session.inviteCode}
                sessionId={session._id}
              />
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {status !== "waiting" && steps.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-sm font-mono">
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
                <h2 className="font-bold font-display text-2xl text-foreground">
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
                  className="px-10 rounded-xl bg-primary font-bold font-display text-primary-foreground glow-primary hover:brightness-110 press-down"
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
              <div className="flex items-center gap-2 mb-4">
                <Badge
                  className={cn(
                    "text-xs",
                    currentStep.type === "theory"
                      ? "bg-choice-blue/15 text-choice-blue border-choice-blue/30"
                      : "bg-choice-yellow/15 text-choice-yellow border-choice-yellow/30"
                  )}
                  variant="outline"
                >
                  {currentStep.type === "theory" ? "Theory" : "Quiz"}
                </Badge>
                {currentStep.timeLimitSeconds && (
                  <Badge className="bg-muted text-muted-foreground border-border" variant="outline">
                    ⏱ {currentStep.timeLimitSeconds}s
                  </Badge>
                )}
              </div>
              <div className="space-y-4">
                {currentStep.type === "theory" ? (
                  <>
                    {currentStep.markdownContent && (
                      <MarkdownViewer content={currentStep.markdownContent} />
                    )}
                    {currentStep.codeBlock && (
                      <pre className="overflow-x-auto rounded-xl border border-border bg-surface-soft p-4 font-mono text-sm text-foreground">
                        <code>
                          {currentStep.codeBlock.code}
                        </code>
                      </pre>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="font-bold font-display text-xl text-foreground">
                      {currentStep.question}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {(currentStep.choices ?? []).map((choice, i) => (
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
                          value={
                            participantCount
                              ? (answeredCount / participantCount) * 100
                              : 0
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {showLeaderboard && leaderboard && leaderboard.length > 0 && (
            <div className="surface-raised p-5">
              <h3 className="font-display text-foreground mb-3">
                {t("play.leaderboardTitle")}
              </h3>
              <Leaderboard entries={leaderboard} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="surface-raised p-5">
            <h3 className="font-display text-sm text-foreground mb-3">Controls</h3>
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
                  className="w-full rounded-xl bg-primary font-bold text-primary-foreground glow-sm hover:brightness-110 press-down"
                  disabled={advancing || (isQuiz && !answerRevealed)}
                  onClick={handleAdvance}
                >
                  {isLastStep ? t("session.endSession") : t("session.nextStep")}
                </Button>
              )}
              {status === "finished" && (
                <Button asChild className="w-full rounded-xl bg-primary text-primary-foreground glow-sm hover:brightness-110">
                  <Link href={`/host/session/${session._id}/results`}>
                    {t("session.viewResults")}
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="surface-raised p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm text-foreground">Participants</h3>
              <span className="inline-flex items-center rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-primary text-xs">
                {participantCount}
              </span>
            </div>
            {participantCount === 0 ? (
              <p className="text-muted-foreground text-xs">
                Waiting for players to join...
              </p>
            ) : (
              <ul aria-label="Participants list" className="space-y-1.5">
                {participants.map((p) => (
                  <li
                    className="flex items-center justify-between text-sm text-foreground"
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
        </div>
      </div>
    </div>
  );
}
