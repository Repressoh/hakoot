"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/routing";
import { QuizStepEditor } from "./quiz-step-editor";
import { TheoryStepEditor } from "./theory-step-editor";

export default function StepEditorPage() {
  const { gameId, stepId } = useParams<{ gameId: string; stepId: string }>();
  const step = useQuery(api.steps.get, { stepId: stepId as Id<"gameSteps"> });

  if (step === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading step&hellip;</p>
      </div>
    );
  }

  if (step === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Step not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          className="text-muted-foreground text-sm hover:text-foreground"
          href={`/games/${gameId}`}
        >
          ← Back to game
        </Link>
      </div>

      {step.type === "theory" ? (
        <TheoryStepEditor step={step} />
      ) : (
        <QuizStepEditor step={step} />
      )}
    </div>
  );
}
