"use client";

import type { FunctionReturnType } from "convex/server";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

const MarkdownViewer = dynamic(
  () =>
    import("@/components/game/markdown-viewer").then(
      (mod) => mod.MarkdownViewer
    ),
  { loading: () => <Skeleton className="h-16 w-full" />, ssr: false }
);

const ClientCodeBlock = dynamic(
  () =>
    import("@/components/game/client-code-block").then(
      (mod) => mod.ClientCodeBlock
    ),
  { ssr: false }
);

const StepImage = dynamic(
  () => import("@/components/game/step-image").then((mod) => mod.StepImage),
  { ssr: false }
);

type SharedStep = FunctionReturnType<
  typeof api.sharing.getSharedGameSteps
>["page"][number];

function SharedStepContent({ step }: { step: SharedStep }) {
  const t = useTranslations("stepEditor");

  if (step.type === "quiz") {
    return (
      <div className="space-y-4">
        <p className="font-semibold text-foreground">
          {step.question || t("questionLabel")}
        </p>
        {step.image ? <StepImage image={step.image} /> : null}
        <p className="font-mono text-muted-foreground text-xs">
          {step.timeLimitSeconds
            ? t("timerSeconds", { seconds: step.timeLimitSeconds })
            : t("timerOff")}
        </p>
        <ul aria-label={t("choicesLabel")} className="space-y-2">
          {(step.choices ?? []).map((choice, index) => (
            <li
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                choice.isCorrect
                  ? "border-choice-green/40 bg-choice-green/10"
                  : "border-border/60"
              )}
              key={String.fromCharCode(65 + index)}
            >
              <span className="font-mono text-muted-foreground">
                {String.fromCharCode(65 + index)}.
              </span>
              <span className="wrap-anywhere min-w-0 flex-1 whitespace-pre-wrap">
                {choice.text}
              </span>
              {choice.isCorrect ? (
                <Badge variant="outline">{t("correctAnswer")}</Badge>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {step.image ? <StepImage image={step.image} /> : null}
      {step.markdownContent ? (
        <div className="overflow-x-auto">
          <MarkdownViewer
            className="wrap-anywhere text-sm"
            content={step.markdownContent}
          />
        </div>
      ) : null}
      {step.codeBlock?.code.trim() ? (
        <ClientCodeBlock
          code={step.codeBlock.code}
          language={step.codeBlock.language}
        />
      ) : null}
      {step.codeBlock && step.codeBlock.annotations.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">{t("annotationsLabel")}</h3>
          <dl className="space-y-3 text-sm">
            {step.codeBlock.annotations.map((annotation, index) => (
              // Annotations have no IDs and can be identical; these read-only rows have no state.
              // biome-ignore lint/suspicious/noArrayIndexKey: No persistent annotation identity exists.
              <div key={`${index}-${annotation.label}`}>
                <dt className="font-medium">
                  {annotation.label}
                  <span className="ms-2 font-mono text-muted-foreground text-xs">
                    {t("annotationLinesLabel")}: {annotation.lines.join(", ")}
                  </span>
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {annotation.explanation}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

/** A disclosure, with no editor links, fields, or mutation controls. */
function SharedStepPreview({
  index,
  step,
}: {
  index: number;
  step: SharedStep;
}) {
  const t = useTranslations("stepEditor");
  const tEditor = useTranslations("gameEditor");
  const [open, setOpen] = useState(false);
  const title = t(step.type === "theory" ? "theoryTitle" : "quizTitle");
  const preview = step.type === "quiz" ? step.question : step.markdownContent;

  return (
    <li className="border-border/60 border-b last:border-0">
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer rounded-lg px-2 py-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2">
          <span className="ms-2 font-mono text-muted-foreground text-xs">
            {tEditor("stepOrder", { number: index + 1 })}
          </span>
          <span className="ms-3 font-medium text-sm">{title}</span>
          {preview ? (
            <span className="mt-1 block truncate ps-6 text-muted-foreground text-sm">
              {preview}
            </span>
          ) : null}
        </summary>
        {open ? (
          <div className="wrap-anywhere min-w-0 px-2 pt-1 pb-6 sm:px-6">
            <SharedStepContent step={step} />
          </div>
        ) : null}
      </details>
    </li>
  );
}

export function SharedGameSteps({
  onLoadMore,
  status,
  stepCount,
  steps,
}: {
  onLoadMore: () => void;
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  stepCount: number;
  steps: SharedStep[];
}) {
  const t = useTranslations();

  return (
    <section aria-labelledby="shared-steps-heading" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold text-lg" id="shared-steps-heading">
          {t("dashboard.steps", { count: stepCount })}
        </h2>
        <Badge variant="outline">{t("stepEditor.previewTab")}</Badge>
      </div>
      <p className="text-muted-foreground text-sm">{t("sharing.copyHint")}</p>
      {status === "LoadingFirstPage" ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <ol className="min-w-0">
          {steps.map((step, index) => (
            <SharedStepPreview index={index} key={step._id} step={step} />
          ))}
        </ol>
      )}
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          className="w-full"
          disabled={status === "LoadingMore"}
          onClick={onLoadMore}
          variant="outline"
        >
          {t(status === "LoadingMore" ? "common.loading" : "common.next")}
        </Button>
      ) : null}
    </section>
  );
}
