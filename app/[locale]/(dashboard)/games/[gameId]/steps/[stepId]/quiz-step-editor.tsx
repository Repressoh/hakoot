"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const TIMER_OPTIONS: (number | null)[] = [null, 10, 20, 30, 60, 90, 120];

interface QuizChoice {
  text: string;
  isCorrect: boolean;
}

interface Step {
  _id: Id<"gameSteps">;
  type: "theory" | "quiz";
  question?: string;
  choices?: QuizChoice[];
  timeLimitSeconds?: number;
}

interface Props {
  step: Step;
}

export function QuizStepEditor({ step }: Props) {
  const t = useTranslations("stepEditor");
  const updateQuiz = useMutation(api.steps.updateQuiz);
  const [saving, setSaving] = useState(false);

  const [question, setQuestion] = useState(step.question ?? "");
  const [choices, setChoices] = useState<QuizChoice[]>(
    step.choices ?? [
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ]
  );
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(
    step.timeLimitSeconds ?? null
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

  async function handleSave() {
    if (!question.trim()) {
      toast.error("Question is required");
      return;
    }
    const hasCorrect = choices.some((c) => c.isCorrect);
    if (!hasCorrect) {
      toast.error("Mark at least one answer as correct");
      return;
    }

    setSaving(true);
    try {
      await updateQuiz({
        stepId: step._id,
        question,
        choices,
        timeLimitSeconds: timeLimitSeconds ?? undefined,
      });
      toast.success("Saved!");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
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
        <h1 className="font-bold text-xl">{t("quizTitle")}</h1>
        <Button disabled={saving} onClick={handleSave}>
          {saving ? "Saving..." : t("saveStep")}
        </Button>
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
          {TIMER_OPTIONS.filter((s): s is number => s !== null).map((s) => (
            <option key={s} value={s}>
              {t("timerSeconds", { seconds: s })}
            </option>
          ))}
        </select>
        {timeLimitSeconds && (
          <p className="text-muted-foreground text-xs">
            Faster answers earn more points (Kahoot-style scoring)
          </p>
        )}
      </div>
    </div>
  );
}
