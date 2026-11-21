"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  PlayIcon,
  RefreshIcon,
  SmartPhone01Icon,
  Tv01Icon,
  UserMultipleIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ClientCodeBlock } from "@/components/game/client-code-block";
import { MarkdownViewer } from "@/components/game/markdown-viewer";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { CHOICE_SHAPES } from "@/components/session/choice-shapes";
import { CircularTimer } from "@/components/session/circular-timer";
import { Leaderboard } from "@/components/session/leaderboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/routing";
import {
  advanceDemoStep,
  createInitialDemoState,
  DEMO_VISITOR_ID,
  type DemoSessionState,
  getCurrentDemoStep,
  getDemoLeaderboard,
  getStepAnswerCount,
  renameDemoVisitor,
  revealDemoAnswer,
  startDemoSession,
  submitDemoAnswer,
} from "@/lib/demo-engine";
import {
  DEMO_BOTS,
  type DemoCodeAnnotation,
  type DemoLesson,
  type DemoQuizStep,
  type DemoTheoryStep,
  getDemoLesson,
} from "@/lib/demo-lesson";
import { cn } from "@/lib/utils";

type ViewMode = "split" | "host" | "player";

const CHOICE_BUTTON_STYLES = [
  "border-choice-red/40 bg-choice-red/15 text-foreground hover:bg-choice-red/25",
  "border-choice-blue/40 bg-choice-blue/15 text-foreground hover:bg-choice-blue/25",
  "border-choice-yellow/40 bg-choice-yellow/15 text-foreground hover:bg-choice-yellow/25",
  "border-choice-green/40 bg-choice-green/15 text-foreground hover:bg-choice-green/25",
] as const;

const CHOICE_ICON_BG = [
  "bg-choice-red text-white",
  "bg-choice-blue text-white",
  "bg-choice-yellow text-black",
  "bg-choice-green text-black",
] as const;

interface AnnotationExplorerProps {
  annotations: DemoCodeAnnotation[];
  label: string;
}

function AnnotationExplorer({ annotations, label }: AnnotationExplorerProps) {
  const [selectedId, setSelectedId] = useState<string>(
    annotations[0]?.id ?? ""
  );

  const selected =
    annotations.find((item) => item.id === selectedId) ?? annotations[0];

  if (!selected) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-surface-soft/70 p-3">
      <p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {annotations.map((annotation) => {
          const isActive = annotation.id === selected.id;
          return (
            <button
              aria-pressed={isActive}
              className={cn(
                "rounded-lg border px-2.5 py-1 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive
                  ? "border-primary bg-primary/15 font-semibold text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
              key={annotation.id}
              onClick={() => setSelectedId(annotation.id)}
              type="button"
            >
              {annotation.lineLabel}
            </button>
          );
        })}
      </div>
      <p className="text-foreground text-sm leading-relaxed">
        {selected.explanation}
      </p>
    </div>
  );
}

interface HostPanelProps {
  lesson: DemoLesson;
  onAdvance: () => void;
  onRestart: () => void;
  onReveal: () => void;
  onStart: () => void;
  state: DemoSessionState;
}

function HostPanel({
  lesson,
  onAdvance,
  onRestart,
  onReveal,
  onStart,
  state,
}: HostPanelProps) {
  const t = useTranslations("demo");
  const currentStep = getCurrentDemoStep(state, lesson);
  const leaderboard = getDemoLeaderboard(state);
  const visitorName =
    state.participants.find((p) => p.id === DEMO_VISITOR_ID)?.name ?? "";

  return (
    <section
      aria-label={t("hostScreenLabel")}
      className="surface-elevated flex flex-col rounded-2xl border border-border/80"
    >
      <div className="flex items-center justify-between gap-2 border-border/60 border-b px-5 py-3.5">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4 text-primary"
            icon={Tv01Icon}
          />
          <span className="font-display font-semibold text-sm">
            {t("hostScreenLabel")}
          </span>
        </div>
        {state.status === "in_progress" ? (
          <Badge variant="outline">
            {t("stepProgress", {
              current: state.currentStepIndex + 1,
              total: lesson.steps.length,
            })}
          </Badge>
        ) : (
          <Badge variant="secondary">
            {state.status === "waiting"
              ? t("statusLobby")
              : t("statusFinished")}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5">
        {state.status === "waiting" && (
          <div className="flex flex-1 flex-col justify-between gap-6">
            <div className="space-y-4">
              <div>
                <h2 className="font-bold font-display text-xl tracking-tight">
                  {lesson.title}
                </h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  {lesson.description}
                </p>
              </div>

              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
                <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
                  {t("inviteCodeLabel")}
                </p>
                <p className="mt-1 font-bold font-mono text-3xl text-primary tracking-[0.25em]">
                  {lesson.inviteCode}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="size-4"
                    icon={UserMultipleIcon}
                  />
                  <span>
                    {t("playersJoined", { count: state.participants.length })}
                  </span>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {state.participants.map((participant) => (
                    <li
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm",
                        participant.id === DEMO_VISITOR_ID
                          ? "border-primary/40 bg-primary/15 font-semibold text-primary"
                          : "border-border bg-surface-soft text-foreground"
                      )}
                      key={participant.id}
                    >
                      {participant.name || t("defaultVisitorName")}
                      {participant.id === DEMO_VISITOR_ID
                        ? ` (${t("youTag")})`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Button
              className="glow-primary press-down w-full rounded-xl bg-primary font-bold font-display text-primary-foreground hover:brightness-110"
              onClick={onStart}
              size="lg"
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="size-4"
                icon={PlayIcon}
              />
              {t("startSession")}
            </Button>
          </div>
        )}

        {state.status === "in_progress" && currentStep?.type === "theory" && (
          <HostTheoryContent
            key={currentStep.id}
            onAdvance={onAdvance}
            step={currentStep}
          />
        )}

        {state.status === "in_progress" && currentStep?.type === "quiz" && (
          <HostQuizContent
            answerCount={getStepAnswerCount(state, currentStep.id)}
            answerRevealed={state.answerRevealed}
            isLastStep={state.currentStepIndex === lesson.steps.length - 1}
            key={currentStep.id}
            leaderboard={leaderboard}
            onAdvance={onAdvance}
            onReveal={onReveal}
            participantCount={state.participants.length}
            step={currentStep}
            stepStartedAt={state.stepStartedAt ?? Date.now()}
            visitorName={visitorName}
          />
        )}

        {state.status === "finished" && (
          <div className="flex flex-1 flex-col justify-between gap-5">
            <div className="space-y-4">
              <div>
                <h2 className="font-bold font-display text-xl">
                  {t("finalLeaderboard")}
                </h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  {t("finishedSubtitle")}
                </p>
              </div>
              <Leaderboard
                entries={leaderboard.map((entry) => ({
                  name: entry.name,
                  rank: entry.rank,
                  score: entry.totalScore,
                }))}
                highlightName={visitorName}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                className="flex-1 rounded-xl"
                onClick={onRestart}
                size="lg"
                variant="outline"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-4"
                  icon={RefreshIcon}
                />
                {t("restartDemo")}
              </Button>
              <Button
                asChild
                className="glow-primary press-down flex-1 rounded-xl bg-primary font-bold font-display text-primary-foreground hover:brightness-110"
                size="lg"
              >
                <Link href="/sign-up">{t("createOwnGame")}</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function HostTheoryContent({
  onAdvance,
  step,
}: {
  onAdvance: () => void;
  step: DemoTheoryStep;
}) {
  const t = useTranslations("demo");
  return (
    <div className="flex flex-1 flex-col justify-between gap-5">
      <div className="space-y-4">
        <p className="font-display font-semibold text-primary text-xs uppercase tracking-wider">
          {t("theoryLabel")}
        </p>
        <MarkdownViewer content={step.markdownContent} />
        <ClientCodeBlock
          code={step.codeBlock.code}
          language={step.codeBlock.language}
        />
        <AnnotationExplorer
          annotations={step.codeBlock.annotations}
          label={t("codeNotesLabel")}
        />
      </div>

      <Button
        className="glow-primary press-down w-full rounded-xl bg-primary font-bold font-display text-primary-foreground hover:brightness-110"
        onClick={onAdvance}
        size="lg"
      >
        {t("nextStep")}
        <HugeiconsIcon
          aria-hidden="true"
          className="size-4"
          icon={ArrowRight01Icon}
        />
      </Button>
    </div>
  );
}

interface HostQuizContentProps {
  answerCount: number;
  answerRevealed: boolean;
  isLastStep: boolean;
  leaderboard: ReturnType<typeof getDemoLeaderboard>;
  onAdvance: () => void;
  onReveal: () => void;
  participantCount: number;
  step: DemoQuizStep;
  stepStartedAt: number;
  visitorName: string;
}

function HostQuizContent({
  answerCount,
  answerRevealed,
  isLastStep,
  leaderboard,
  onAdvance,
  onReveal,
  participantCount,
  step,
  stepStartedAt,
  visitorName,
}: HostQuizContentProps) {
  const t = useTranslations("demo");
  return (
    <div className="flex flex-1 flex-col justify-between gap-5">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-display font-semibold text-accent text-xs uppercase tracking-wider">
              {t("quizLabel")}
            </p>
            <h3 className="font-bold font-display text-lg leading-snug">
              {step.question}
            </h3>
            <p className="font-mono text-muted-foreground text-xs">
              {t("answersReceived", {
                answered: answerCount,
                total: participantCount,
              })}
            </p>
          </div>
          {answerRevealed ? null : (
            <CircularTimer
              stepStartedAt={stepStartedAt}
              timeLimitSeconds={step.timeLimitSeconds}
            />
          )}
        </div>

        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {step.choices.map((choice, index) => {
            const Shape = CHOICE_SHAPES[index % CHOICE_SHAPES.length];
            const isHighlighted = answerRevealed && choice.isCorrect;
            const isDimmed = answerRevealed && !choice.isCorrect;
            return (
              <li
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-opacity",
                  isHighlighted
                    ? "border-choice-green bg-choice-green/20 font-semibold"
                    : "border-border/70 bg-surface-soft/70",
                  isDimmed && "opacity-50"
                )}
                key={choice.text}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg",
                    CHOICE_ICON_BG[index % CHOICE_ICON_BG.length]
                  )}
                >
                  {Shape ? <Shape size={14} /> : null}
                </span>
                <span className="flex-1 font-medium">{choice.text}</span>
                {isHighlighted ? (
                  <Badge variant="outline">{t("correctBadge")}</Badge>
                ) : null}
              </li>
            );
          })}
        </ul>

        {answerRevealed ? (
          <div className="space-y-2 pt-1">
            <p className="font-display font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              {t("liveLeaderboard")}
            </p>
            <Leaderboard
              entries={leaderboard.map((entry) => ({
                name: entry.name,
                rank: entry.rank,
                score: entry.totalScore,
              }))}
              highlightName={visitorName}
            />
          </div>
        ) : null}
      </div>

      {answerRevealed ? (
        <Button
          className="glow-primary press-down w-full rounded-xl bg-primary font-bold font-display text-primary-foreground hover:brightness-110"
          onClick={onAdvance}
          size="lg"
        >
          {isLastStep ? t("finishSession") : t("nextStep")}
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4"
            icon={ArrowRight01Icon}
          />
        </Button>
      ) : (
        <Button
          className="w-full rounded-xl font-bold font-display"
          onClick={onReveal}
          size="lg"
          variant="secondary"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4"
            icon={ViewIcon}
          />
          {t("revealAnswer")}
        </Button>
      )}
    </div>
  );
}

interface PlayerPanelProps {
  lesson: DemoLesson;
  onRenameVisitor: (name: string) => void;
  onRestart: () => void;
  onSubmitAnswer: (choiceIndex: number) => void;
  state: DemoSessionState;
}

function PlayerPanel({
  lesson,
  onRenameVisitor,
  onRestart,
  onSubmitAnswer,
  state,
}: PlayerPanelProps) {
  const t = useTranslations("demo");
  const currentStep = getCurrentDemoStep(state, lesson);
  const leaderboard = getDemoLeaderboard(state);
  const visitor = state.participants.find((p) => p.id === DEMO_VISITOR_ID);
  const visitorRank =
    leaderboard.find((entry) => entry.id === DEMO_VISITOR_ID)?.rank ?? 1;
  const quizSteps = lesson.steps.filter((s) => s.type === "quiz");
  const correctCount = quizSteps.filter(
    (step) => visitor?.answers[step.id]?.isCorrect
  ).length;

  return (
    <section
      aria-label={t("playerScreenLabel")}
      className="surface-elevated flex flex-col rounded-2xl border border-border/80"
    >
      <div className="flex items-center justify-between gap-2 border-border/60 border-b px-5 py-3.5">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4 text-accent"
            icon={SmartPhone01Icon}
          />
          <span className="font-display font-semibold text-sm">
            {t("playerScreenLabel")}
          </span>
        </div>
        <Badge className="font-mono tabular-nums" variant="outline">
          {t("pointsPill", { points: visitor?.totalScore ?? 0 })}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5">
        {state.status === "waiting" && (
          <div className="flex flex-1 flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="demo-visitor-name">
                  {t("visitorNameLabel")}
                </Label>
                <Input
                  id="demo-visitor-name"
                  maxLength={32}
                  onChange={(event) => onRenameVisitor(event.target.value)}
                  placeholder={t("visitorNamePlaceholder")}
                  value={visitor?.name ?? ""}
                />
              </div>

              <div className="rounded-xl border border-border/70 bg-surface-soft/70 p-4">
                <div className="flex items-center gap-2 text-primary">
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="size-5 shrink-0"
                    icon={CheckmarkCircle02Icon}
                  />
                  <span className="font-semibold text-sm">
                    {t("joinedLobbyTitle")}
                  </span>
                </div>
                <p className="mt-1.5 text-muted-foreground text-sm">
                  {t("joinedLobbyHint")}
                </p>
              </div>
            </div>

            <p className="text-center font-mono text-muted-foreground text-xs">
              {t("connectedCode", { code: lesson.inviteCode })}
            </p>
          </div>
        )}

        {state.status === "in_progress" && currentStep?.type === "theory" && (
          <div className="flex flex-1 flex-col gap-4" key={currentStep.id}>
            <p className="font-display font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              {t("theoryLabel")}
            </p>
            <MarkdownViewer content={currentStep.markdownContent} />
            <ClientCodeBlock
              code={currentStep.codeBlock.code}
              language={currentStep.codeBlock.language}
            />
            <AnnotationExplorer
              annotations={currentStep.codeBlock.annotations}
              label={t("codeNotesLabel")}
            />
          </div>
        )}

        {state.status === "in_progress" && currentStep?.type === "quiz" && (
          <PlayerQuizContent
            answerRevealed={state.answerRevealed}
            key={currentStep.id}
            leaderboard={leaderboard}
            onSubmitAnswer={onSubmitAnswer}
            step={currentStep}
            stepStartedAt={state.stepStartedAt ?? Date.now()}
            visitorAnswer={visitor?.answers[currentStep.id]}
            visitorName={visitor?.name ?? ""}
          />
        )}

        {state.status === "finished" && (
          <div className="flex flex-1 flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-5 text-center">
                <p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                  {t("yourFinalRank")}
                </p>
                <p className="mt-1 font-bold font-display text-4xl text-primary">
                  #{visitorRank}
                </p>
                <p className="mt-2 font-mono text-foreground text-sm">
                  {t("finalStats", {
                    correct: correctCount,
                    points: visitor?.totalScore ?? 0,
                    total: quizSteps.length,
                  })}
                </p>
              </div>

              <Leaderboard
                entries={leaderboard.map((entry) => ({
                  name: entry.name,
                  rank: entry.rank,
                  score: entry.totalScore,
                }))}
                highlightName={visitor?.name}
              />
            </div>

            <Button
              className="w-full rounded-xl"
              onClick={onRestart}
              size="lg"
              variant="outline"
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="size-4"
                icon={RefreshIcon}
              />
              {t("playAgain")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

interface PlayerQuizContentProps {
  answerRevealed: boolean;
  leaderboard: ReturnType<typeof getDemoLeaderboard>;
  onSubmitAnswer: (choiceIndex: number) => void;
  step: DemoQuizStep;
  stepStartedAt: number;
  visitorAnswer:
    | {
        choiceIndex: number;
        isCorrect: boolean;
        points: number;
      }
    | undefined;
  visitorName: string;
}

function PlayerQuizContent({
  answerRevealed,
  leaderboard,
  onSubmitAnswer,
  step,
  stepStartedAt,
  visitorAnswer,
  visitorName,
}: PlayerQuizContentProps) {
  const t = useTranslations("demo");
  const [isTimeUp, setIsTimeUp] = useState(
    () => Date.now() - stepStartedAt >= step.timeLimitSeconds * 1000
  );

  useEffect(() => {
    if (answerRevealed) {
      return;
    }
    const remainingMs =
      stepStartedAt + step.timeLimitSeconds * 1000 - Date.now();
    if (remainingMs <= 0) {
      setIsTimeUp(true);
      return;
    }
    setIsTimeUp(false);
    const timer = setTimeout(() => {
      setIsTimeUp(true);
    }, remainingMs);
    return () => clearTimeout(timer);
  }, [answerRevealed, step.timeLimitSeconds, stepStartedAt]);

  const isLocked = Boolean(visitorAnswer) || isTimeUp;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-display font-semibold text-accent text-xs uppercase tracking-wider">
            {t("quizLabel")}
          </p>
          <h3 className="font-bold font-display text-lg leading-snug">
            {step.question}
          </h3>
        </div>
        {answerRevealed ? null : (
          <CircularTimer
            stepStartedAt={stepStartedAt}
            timeLimitSeconds={step.timeLimitSeconds}
          />
        )}
      </div>

      {!answerRevealed && visitorAnswer ? (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
          <p className="font-display font-semibold text-primary">
            {t("answerLockedTitle")}
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("answerLockedHint")}
          </p>
        </div>
      ) : null}

      {!(answerRevealed || visitorAnswer) && isTimeUp ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center">
          <p className="font-display font-semibold text-destructive">
            {t("timeUpTitle")}
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("timeUpHint")}
          </p>
        </div>
      ) : null}

      {answerRevealed ? (
        <div className="space-y-4">
          <div
            className={cn(
              "rounded-xl border p-4 text-center",
              visitorAnswer?.isCorrect
                ? "border-choice-green/50 bg-choice-green/15"
                : "border-choice-red/50 bg-choice-red/15"
            )}
          >
            <p className="font-bold font-display text-lg">
              {visitorAnswer?.isCorrect
                ? t("resultCorrect")
                : t("resultIncorrect")}
            </p>
            <p className="mt-1 font-mono text-sm">
              {t("pointsEarned", { points: visitorAnswer?.points ?? 0 })}
            </p>
          </div>

          <Leaderboard
            entries={leaderboard.map((entry) => ({
              name: entry.name,
              rank: entry.rank,
              score: entry.totalScore,
            }))}
            highlightName={visitorName}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {step.choices.map((choice, index) => {
            const Shape = CHOICE_SHAPES[index % CHOICE_SHAPES.length];
            const isSelected = visitorAnswer?.choiceIndex === index;
            return (
              <button
                aria-pressed={isSelected}
                className={cn(
                  "press-down flex items-center gap-3 rounded-xl border-2 px-4 py-4 text-left font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed",
                  CHOICE_BUTTON_STYLES[index % CHOICE_BUTTON_STYLES.length],
                  isSelected && "ring-2 ring-primary",
                  isLocked && !isSelected && "opacity-45"
                )}
                disabled={isLocked}
                key={choice.text}
                onClick={() => onSubmitAnswer(index)}
                type="button"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    CHOICE_ICON_BG[index % CHOICE_ICON_BG.length]
                  )}
                >
                  {Shape ? <Shape size={16} /> : null}
                </span>
                <span className="flex-1 text-base">{choice.text}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DemoExperience() {
  const locale = useLocale();
  const t = useTranslations("demo");
  const lesson = getDemoLesson(locale);

  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [state, setState] = useState<DemoSessionState>(() =>
    createInitialDemoState(t("defaultVisitorName"))
  );

  const currentStep = getCurrentDemoStep(state, lesson);
  const currentStepId = currentStep?.id ?? null;
  const isQuizActive =
    state.status === "in_progress" &&
    currentStep?.type === "quiz" &&
    !state.answerRevealed;

  // Schedule simulated classmates to submit realistic answers during active quiz steps.
  useEffect(() => {
    if (!(isQuizActive && currentStepId)) {
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const bot of DEMO_BOTS) {
      const scripted = bot.answers[currentStepId];
      if (!scripted) {
        continue;
      }
      const timer = setTimeout(() => {
        setState((prev) =>
          submitDemoAnswer(
            prev,
            lesson,
            bot.id,
            scripted.choiceIndex,
            Date.now()
          )
        );
      }, scripted.delayMs);
      timers.push(timer);
    }

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [currentStepId, isQuizActive, lesson]);

  function handleStart() {
    setState((prev) => startDemoSession(prev, Date.now()));
  }

  function handleAdvance() {
    setState((prev) => advanceDemoStep(prev, lesson, Date.now()));
  }

  function handleReveal() {
    setState((prev) => revealDemoAnswer(prev, lesson));
  }

  function handleSubmitAnswer(choiceIndex: number) {
    setState((prev) =>
      submitDemoAnswer(prev, lesson, DEMO_VISITOR_ID, choiceIndex, Date.now())
    );
  }

  function handleRenameVisitor(name: string) {
    setState((prev) => renameDemoVisitor(prev, name));
  }

  function handleRestart() {
    const currentName =
      state.participants.find((p) => p.id === DEMO_VISITOR_ID)?.name ||
      t("defaultVisitorName");
    setState(createInitialDemoState(currentName));
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-grid">
      <header className="sticky top-0 z-20 border-border/60 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button asChild size="sm" variant="ghost">
              <Link href="/">
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-4"
                  icon={ArrowLeft01Icon}
                />
                <span className="font-bold font-display text-base">Hakoot</span>
              </Link>
            </Button>
            <Badge variant="secondary">{t("badge")}</Badge>
          </div>

          <fieldset
            aria-label={t("viewModeLabel")}
            className="flex items-center rounded-lg border border-border bg-surface-soft p-0.5"
          >
            {(["split", "host", "player"] as const).map((mode) => (
              <button
                aria-pressed={viewMode === mode}
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  viewMode === mode
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                key={mode}
                onClick={() => setViewMode(mode)}
                type="button"
              >
                {t(`viewMode.${mode}`)}
              </button>
            ))}
          </fieldset>

          <div className="flex items-center gap-2">
            <Button onClick={handleRestart} size="sm" variant="outline">
              <HugeiconsIcon
                aria-hidden="true"
                className="size-4"
                icon={RefreshIcon}
              />
              {t("restartDemo")}
            </Button>
            <LocaleSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-bold font-display text-2xl tracking-tight">
              {t("heading")}
            </h1>
            <p className="text-muted-foreground text-sm">{t("subheading")}</p>
          </div>
        </div>

        <div
          className={cn(
            "grid flex-1 gap-6",
            viewMode === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
          )}
        >
          {viewMode === "player" ? null : (
            <HostPanel
              lesson={lesson}
              onAdvance={handleAdvance}
              onRestart={handleRestart}
              onReveal={handleReveal}
              onStart={handleStart}
              state={state}
            />
          )}
          {viewMode === "host" ? null : (
            <PlayerPanel
              lesson={lesson}
              onRenameVisitor={handleRenameVisitor}
              onRestart={handleRestart}
              onSubmitAnswer={handleSubmitAnswer}
              state={state}
            />
          )}
        </div>
      </main>
    </div>
  );
}
