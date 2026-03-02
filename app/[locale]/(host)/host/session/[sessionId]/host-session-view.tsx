"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { MarkdownViewer } from "@/components/game/markdown-viewer";
import { InviteCodeDisplay } from "@/components/session/invite-code-display";
import { Leaderboard } from "@/components/session/leaderboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useSse } from "@/hooks/use-sse";
import { Link, useRouter } from "@/i18n/routing";
import type {
  Game,
  GameParticipant,
  GameSession,
  GameStep,
} from "@/lib/db/schema";
import { cn } from "@/lib/utils";

interface Props {
  game: Game;
  initialParticipants: GameParticipant[];
  session: GameSession;
  steps: GameStep[];
}

interface LeaderboardEntry {
  name: string;
  rank: number;
  score: number;
}

const CHOICE_BG = [
  "bg-choice-red text-white",
  "bg-choice-blue text-white",
  "bg-choice-yellow text-white",
  "bg-choice-green text-white",
];

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: real-time session view
export function HostSessionView({
  session,
  game,
  steps,
  initialParticipants,
}: Props) {
  const t = useTranslations();
  const router = useRouter();

  const [status, setStatus] = useState(session.status);
  const [currentIndex, setCurrentIndex] = useState(session.currentStepIndex);
  const [participants, setParticipants] = useState(initialParticipants);
  const [answerRevealed, setAnswerRevealed] = useState(session.answerRevealed);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [revealing, setRevealing] = useState(false);

  useSse(session.id, {
    participant_joined: useCallback((data: Record<string, unknown>) => {
      const { name } = data as { name: string };
      setParticipants((prev) => [...prev, { name } as GameParticipant]);
      toast.info(`${name} joined!`);
    }, []),
    answer_received: useCallback((data: Record<string, unknown>) => {
      const { answered } = data as { answered: number };
      setAnsweredCount(answered);
    }, []),
    answer_revealed: useCallback((data: Record<string, unknown>) => {
      const { leaderboard: lb } = data as { leaderboard: LeaderboardEntry[] };
      setAnswerRevealed(true);
      setLeaderboard(lb);
      setShowLeaderboard(true);
    }, []),
    session_ended: useCallback(() => {
      setStatus("finished");
      router.push(`/host/session/${session.id}/results`);
    }, [router, session.id]),
  });

  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;

  async function handleAdvance() {
    setAdvancing(true);
    setAnsweredCount(0);
    setAnswerRevealed(false);
    setShowLeaderboard(false);
    try {
      const res = await fetch(`/api/sessions/${session.id}/advance`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.stepIndex !== undefined) {
        setCurrentIndex(data.stepIndex);
        if (data.status === "finished") {
          setStatus("finished");
        } else {
          setStatus("in_progress");
        }
      }
    } catch {
      toast.error("Failed to advance");
    } finally {
      setAdvancing(false);
    }
  }

  async function handleReveal() {
    setRevealing(true);
    try {
      await fetch(`/api/sessions/${session.id}/reveal`, { method: "POST" });
    } catch {
      toast.error("Failed to reveal");
    } finally {
      setRevealing(false);
    }
  }

  const isQuiz = currentStep?.type === "quiz";
  const isLastStep = currentIndex >= steps.length - 1;

  const statusBadgeVariant = status === "in_progress" ? "default" : "secondary";

  return (
    <div className="min-h-screen bg-surface-soft">
      <header className="sticky top-0 z-40 border-border/50 border-b bg-white">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <span className="font-bold font-display">{game.title}</span>
            <Badge variant={statusBadgeVariant}>
              {t(`session.sessionStatus.${status}`)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {status === "waiting" && (
              <span className="text-muted-foreground text-sm">
                {t("session.participantsJoined", {
                  count: participants.length,
                })}
              </span>
            )}
            {status !== "finished" && (
              <InviteCodeDisplay
                code={session.inviteCode}
                sessionId={session.id}
              />
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {status !== "waiting" && steps.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-sm">
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
            <Card className="rounded-xl border-border/50 bg-white shadow-sm">
              <CardContent className="space-y-6 py-16 text-center">
                <h2 className="font-bold font-display text-2xl">
                  {t("session.waitingRoom")}
                </h2>
                <p className="text-muted-foreground">
                  {t("session.participantsJoined", {
                    count: participants.length,
                  })}
                </p>
                <InviteCodeDisplay
                  code={session.inviteCode}
                  large
                  sessionId={session.id}
                />
                <Button
                  className="px-10"
                  disabled={advancing || participants.length === 0}
                  onClick={handleAdvance}
                  size="lg"
                >
                  {t("session.startSession")}
                </Button>
              </CardContent>
            </Card>
          )}

          {status === "in_progress" && currentStep && (
            <Card className="rounded-xl border-border/50 bg-white shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      currentStep.type === "theory"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-amber-50 text-amber-700"
                    )}
                    variant="outline"
                  >
                    {currentStep.type === "theory" ? "Theory" : "Quiz"}
                  </Badge>
                  {currentStep.timeLimitSeconds && (
                    <Badge className="bg-muted" variant="secondary">
                      ⏱ {currentStep.timeLimitSeconds}s
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentStep.type === "theory" ? (
                  <>
                    {currentStep.markdownContent && (
                      <MarkdownViewer content={currentStep.markdownContent} />
                    )}
                    {currentStep.codeBlock && (
                      <pre className="overflow-x-auto rounded-xl border border-border/50 bg-surface-soft p-4 font-mono text-sm">
                        <code>
                          {(currentStep.codeBlock as { code: string }).code}
                        </code>
                      </pre>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="font-bold font-display text-xl">
                      {currentStep.question}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {(currentStep.choices ?? []).map((choice, i) => (
                        <div
                          className={cn(
                            "rounded-xl p-3 font-medium text-sm",
                            answerRevealed && choice.isCorrect
                              ? "border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                              : CHOICE_BG[i]
                          )}
                          key={String.fromCharCode(65 + i)}
                        >
                          <span className="mr-2 font-mono opacity-70">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          {choice.text}
                          {answerRevealed && choice.isCorrect && (
                            <span className="ml-2 text-emerald-600">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {!answerRevealed && (
                      <div className="flex items-center gap-3 text-muted-foreground text-sm">
                        <span>
                          {t("session.answeredCount", {
                            answered: answeredCount,
                            total: participants.length,
                          })}
                        </span>
                        <Progress
                          aria-label="Answer progress"
                          className="h-2 flex-1"
                          value={
                            participants.length
                              ? (answeredCount / participants.length) * 100
                              : 0
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {showLeaderboard && leaderboard.length > 0 && (
            <Card className="rounded-xl border-primary/30 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="font-display">
                  {t("play.leaderboardTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Leaderboard entries={leaderboard} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="rounded-xl border-border/50 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="font-display text-sm">Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {status === "in_progress" && isQuiz && !answerRevealed && (
                <Button
                  className="w-full"
                  disabled={revealing}
                  onClick={handleReveal}
                  variant="outline"
                >
                  {t("session.revealAnswer")}
                </Button>
              )}
              {status === "in_progress" && (
                <Button
                  className="w-full"
                  disabled={advancing || (isQuiz && !answerRevealed)}
                  onClick={handleAdvance}
                >
                  {isLastStep ? t("session.endSession") : t("session.nextStep")}
                </Button>
              )}
              {status === "finished" && (
                <Button asChild className="w-full">
                  <Link href={`/host/session/${session.id}/results`}>
                    {t("session.viewResults")}
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between font-display text-sm">
                <span>Participants</span>
                <Badge
                  className="bg-primary/10 text-primary"
                  variant="secondary"
                >
                  {participants.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Waiting for players to join...
                </p>
              ) : (
                <ul aria-label="Participants list" className="space-y-1.5">
                  {participants.map((p, i) => (
                    <li
                      className="flex items-center justify-between text-sm"
                      key={p.id ?? i}
                    >
                      <span>{p.name}</span>
                      {p.totalScore !== undefined && p.totalScore > 0 && (
                        <span className="font-mono text-muted-foreground text-xs">
                          {p.totalScore}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
