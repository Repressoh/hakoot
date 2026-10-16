"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getUnsavedDraft, useAutosave } from "@/lib/use-autosave";
import { cn } from "@/lib/utils";
import { SaveStatus } from "./save-status";

const TIMER_OPTIONS: (number | null)[] = [null, 10, 20, 30, 60, 90, 120];

interface QuizChoice {
  isCorrect: boolean;
  text: string;
}

interface Step {
  _id: Id<"gameSteps">;
  choices?: QuizChoice[];
  question?: string;
  timeLimitSeconds?: number;
  type: "theory" | "quiz";
}

interface Props {
  step: Step;
}

/** What the editor saves, and the unsaved draft it can start from. */
interface QuizDraft {
  choices: QuizChoice[];
  question: string;
  timeLimitSeconds: number | null;
}

/** Editor for a quiz step's question, answer choices and time limit; changes save automatically. */
export function QuizStepEditor({ step }: Props) {
  const t = useTranslations("stepEditor");
  const updateQuiz = useMutation(api.steps.updateQuiz);

  const [initial] = useState<QuizDraft>(
    () =>
      getUnsavedDraft<QuizDraft>(step._id) ?? {
        choices: step.choices ?? [
          { isCorrect: false, text: "" },
          { isCorrect: false, text: "" },
          { isCorrect: false, text: "" },
          { isCorrect: false, text: "" },
        ],
        question: step.question ?? "",
        timeLimitSeconds: step.timeLimitSeconds ?? null,
      }
  );
  const [question, setQuestion] = useState(initial.question);
  const [choices, setChoices] = useState(initial.choices);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(
    initial.timeLimitSeconds
  );
  const hasCorrect = choices.some((c) => c.isCorrect);

  // Drafts are saved as they are: a quiz without a question or a correct
  // answer can still be played, so the hint below only points it out.
  const saveStatus = useAutosave<QuizDraft>(
    step._id,
    { choices, question, timeLimitSeconds },
    (quiz) => updateQuiz({ ...quiz, stepId: step._id }),
    () => toast.error(t("saveFailed"), { id: "step-autosave" })
  );

  function updateChoice(i: number, text: string) {
    setChoices((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, text } : c))
    );
  }

  function setCorrect(i: number) {
    setChoices((prev) =>
      prev.map((c, idx) => ({ ...c, isCorrect: idx === i }))
    );
  }

  const CHOICE_COLORS = [
    "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
    "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
    "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800",
    "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-xl">{t("quizTitle")}</h1>
        <SaveStatus status={saveStatus} />
      </div>

      {/* Question */}
      <div className="space-y-1.5">
        <Label htmlFor="question">{t("questionLabel")}</Label>
        <Input
          className="text-base"
          id="question"
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("questionPlaceholder")}
          value={question}
        />
      </div>

      {/* Choices */}
      <div className="space-y-3">
        <Label>{t("choicesLabel")}</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {choices.map((choice, i) => (
            <div
              className={cn(
                "space-y-2 rounded-lg border-2 p-3 transition-colors",
                CHOICE_COLORS[i],
                choice.isCorrect && "ring-2 ring-green-500"
              )}
              key={String.fromCharCode(65 + i)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase">
                  {String.fromCharCode(65 + i)}
                </span>
                <button
                  aria-label={
                    choice.isCorrect ? t("correctAnswer") : t("markCorrect")
                  }
                  aria-pressed={choice.isCorrect}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs transition-colors",
                    choice.isCorrect
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-muted-foreground/30 text-muted-foreground hover:border-green-500 hover:text-green-600"
                  )}
                  onClick={() => setCorrect(i)}
                  type="button"
                >
                  {choice.isCorrect
                    ? `✓ ${t("correctAnswer")}`
                    : t("markCorrect")}
                </button>
              </div>
              <Input
                className="bg-background/80"
                onChange={(e) => updateChoice(i, e.target.value)}
                placeholder={t("choicePlaceholder", { number: i + 1 })}
                value={choice.text}
              />
            </div>
          ))}
        </div>
        {hasCorrect ? null : (
          <p className="text-muted-foreground text-xs">
            {t("noCorrectAnswer")}
          </p>
        )}
      </div>

      {/* Timer */}
      <div className="space-y-1.5">
        <Label htmlFor="timer">{t("timerLabel")}</Label>
        <select
          className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
          id="timer"
          onChange={(e) =>
            setTimeLimitSeconds(e.target.value ? Number(e.target.value) : null)
          }
          value={timeLimitSeconds ?? ""}
        >
          <option value="">{t("timerOff")}</option>
          {TIMER_OPTIONS.reduce<ReactNode[]>((options, seconds) => {
            if (seconds !== null) {
              options.push(
                <option key={seconds} value={seconds}>
                  {t("timerSeconds", { seconds })}
                </option>
              );
            }
            return options;
          }, [])}
        </select>
        {timeLimitSeconds ? (
          <p className="text-muted-foreground text-xs">
            Faster answers earn more points (Kahoot-style scoring)
          </p>
        ) : null}
      </div>
    </div>
  );
}
