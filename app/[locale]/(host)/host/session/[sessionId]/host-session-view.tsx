"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MarkdownViewer } from "@/components/game/markdown-viewer";
import { InviteCodeDisplay } from "@/components/session/invite-code-display";
import { Leaderboard } from "@/components/session/leaderboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const sessionIdRef = useRef(session.id);
  const statusRef = useRef(status);
  const answerRevealedRef = useRef(answerRevealed);
  statusRef.current = status;
  answerRevealedRef.current = answerRevealed;

  // Polling fallback: refresh answered count when SSE events are missed (e.g. after reconnect)
  useEffect(() => {
    const poll = async () => {
      if (statusRef.current !== "in_progress" || answerRevealedRef.current) return;
      try {
        const res = await fetch(`/api/sessions/${sessionIdRef.current}/answers-count`);
        if (res.ok) {
          const data = await res.json() as { answered: number; total: number };
          setAnsweredCount(data.answered);
        }
      } catch {
        // ignore
      }
    };

    const id = setInterval(() => { void poll(); }, 3000);
    return () => clearInterval(id);
  }, []);

  useSse(session.id, {
    participant_joined: useCallback((data: Record<string, unknown>) => {
      const { name } = data as { name: string };
      setParticipants((prev) => [...prev, { name } as GameParticipant]);
      toast.info(`${name} joined!`);
    }, []),
    answer_received: useCallback((data: Record<string, unknown>) => {
      const { answered, total } = data as { answered: number; total: number };
      setAnsweredCount(answered);
      // When all players have answered, trigger reveal (idempotent — safe to call
      // even if auto-reveal already fired; it will re-publish the SSE event)
      if (total > 0 && answered >= total) {
        fetch(`/api/sessions/${sessionIdRef.current}/reveal`, { method: "POST" }).catch(
          () => {}
        );
      }
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <span className="font-bold font-display text-foreground">{game.title}</span>
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
                    count: participants.length,
                  })}
                </p>
                <InviteCodeDisplay
                  code={session.inviteCode}
                  large
                  sessionId={session.id}
                />
                <Button
                  className="px-10 rounded-xl bg-primary font-bold font-display text-primary-foreground glow-primary hover:brightness-110 press-down"
                  disabled={advancing || participants.length === 0}
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
                          {(currentStep.codeBlock as { code: string }).code}
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
              </div>
            </div>
          )}

          {showLeaderboard && leaderboard.length > 0 && (
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
                  <Link href={`/host/session/${session.id}/results`}>
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
                {participants.length}
              </span>
            </div>
            {participants.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Waiting for players to join...
              </p>
            ) : (
              <ul aria-label="Participants list" className="space-y-1.5">
                {participants.map((p, i) => (
                  <li
                    className="flex items-center justify-between text-sm text-foreground"
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
          </div>
        </div>
      </div>
    </div>
  );
}
