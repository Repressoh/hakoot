"use client";

import type { FunctionReturnType } from "convex/server";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type Ref, useEffect, useRef, useState } from "react";
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

/** Keep rows stable when reordered, including repeated annotations with identical content. */
function keyedAnnotations(
  annotations: NonNullable<SharedStep["codeBlock"]>["annotations"]
) {
  const occurrences = new Map<string, number>();
  return annotations.map((annotation) => {
    const content = JSON.stringify([
      annotation.label,
      annotation.lines,
      annotation.explanation,
    ]);
    const occurrence = occurrences.get(content) ?? 0;
    occurrences.set(content, occurrence + 1);
    return { annotation, key: `${content}:${occurrence}` };
  });
}

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
        <ul
          aria-label={t("choicesLabel")}
          className="grid gap-3 sm:grid-cols-2"
        >
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
            {keyedAnnotations(step.codeBlock.annotations).map(
              ({ annotation, key }) => (
                <div key={key}>
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
              )
            )}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

/** Navigation only: no drag handles, forms, or editing actions. */
function StepNavigation({
  navigationRef,
  onSelect,
  selectedId,
  steps,
}: {
  navigationRef: Ref<HTMLOListElement>;
  onSelect: (id: SharedStep["_id"]) => void;
  selectedId: SharedStep["_id"] | undefined;
  steps: SharedStep[];
}) {
  const t = useTranslations("stepEditor");
  const tEditor = useTranslations("gameEditor");

  return (
    <ol
      className="flex gap-2 overflow-x-auto pb-1 md:block md:max-h-[calc(100svh-18rem)] md:space-y-2 md:overflow-y-auto"
      ref={navigationRef}
    >
      {steps.map((step, index) => (
        <li className="w-44 shrink-0 md:w-auto" key={step._id}>
          <button
            aria-controls="shared-step-content"
            aria-current={selectedId === step._id ? "step" : undefined}
            className={cn(
              "w-full rounded-xl border px-4 py-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
              selectedId === step._id
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border/60 bg-card/80 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            onClick={() => onSelect(step._id)}
            type="button"
          >
            <span className="block font-mono text-xs">
              {tEditor("stepOrder", { number: index + 1 })}
            </span>
            <span className="mt-1 block truncate font-medium text-sm">
              {t(step.type === "theory" ? "theoryTitle" : "quizTitle")}
            </span>
          </button>
        </li>
      ))}
    </ol>
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
  const [selectedStepId, setSelectedStepId] = useState<
    SharedStep["_id"] | null
  >(null);
  const selectedStep =
    steps.find((step) => step._id === selectedStepId) ?? steps[0];
  const selectedIndex = steps.findIndex(
    (step) => step._id === selectedStep?._id
  );
  const previousStep = steps[selectedIndex - 1];
  const nextStep = steps[selectedIndex + 1];
  const navigationRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (status !== "CanLoadMore" || steps.length === 0) {
      return;
    }
    // Keep a page ready before the reader reaches the last loaded step.
    const preloadIndex = Math.max(0, steps.length - 3);
    if (selectedIndex >= preloadIndex) {
      onLoadMore();
      return;
    }
    const navigation = navigationRef.current;
    if (!navigation || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          onLoadMore();
        }
      },
      { root: navigation }
    );
    // A fast swipe can skip the first preload row entirely.
    for (const target of Array.from(navigation.children).slice(preloadIndex)) {
      observer.observe(target);
    }
    return () => observer.disconnect();
  }, [onLoadMore, selectedIndex, status, steps.length]);

  return (
    <div className="grid min-w-0 gap-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8">
      <nav
        aria-labelledby="shared-steps-heading"
        className="min-w-0 space-y-3 md:sticky md:top-6 md:self-start"
      >
        <h2 className="font-semibold text-base" id="shared-steps-heading">
          {t("dashboard.steps", { count: stepCount })}
        </h2>
        {status === "LoadingFirstPage" ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <StepNavigation
            navigationRef={navigationRef}
            onSelect={setSelectedStepId}
            selectedId={selectedStep?._id}
            steps={steps}
          />
        )}
        <div className="flex gap-2">
          <Button
            aria-controls="shared-step-content"
            className="min-w-0 flex-1"
            disabled={!previousStep}
            onClick={() => previousStep && setSelectedStepId(previousStep._id)}
            variant="outline"
          >
            {t("common.previous")}
          </Button>
          <Button
            aria-controls="shared-step-content"
            className="min-w-0 flex-1"
            disabled={!nextStep}
            onClick={() => nextStep && setSelectedStepId(nextStep._id)}
            variant="outline"
          >
            {t(
              !nextStep && status === "LoadingMore"
                ? "common.loading"
                : "common.next"
            )}
          </Button>
        </div>
      </nav>
      <section
        aria-labelledby={selectedStep ? "shared-step-title" : undefined}
        className="min-w-0"
        id="shared-step-content"
      >
        {status === "LoadingFirstPage" ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : null}
        {selectedStep ? (
          <div className="wrap-anywhere space-y-6 rounded-2xl border border-border/60 bg-card/80 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-border/60 border-b pb-4">
              <h2 className="font-semibold text-xl" id="shared-step-title">
                {t(
                  selectedStep.type === "theory"
                    ? "stepEditor.theoryTitle"
                    : "stepEditor.quizTitle"
                )}
              </h2>
              <Badge variant="outline">{t("stepEditor.previewTab")}</Badge>
            </div>
            <SharedStepContent key={selectedStep._id} step={selectedStep} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
