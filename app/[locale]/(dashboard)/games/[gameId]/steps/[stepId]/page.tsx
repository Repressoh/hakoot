import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Link } from "@/i18n/routing";
import { getStep } from "@/lib/actions/step";
import { QuizStepEditor } from "./quiz-step-editor";
import { TheoryStepEditor } from "./theory-step-editor";

interface Props {
  params: Promise<{ gameId: string; stepId: string }>;
}

async function StepEditorContent({
  gameId,
  stepId,
}: {
  gameId: string;
  stepId: string;
}) {
  const step = await getStep(stepId).catch(() => null);

  if (!step || step.gameId !== gameId) {
    notFound();
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

export default async function StepEditorPage({ params }: Props) {
  const { gameId, stepId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading step...</p>
        </div>
      }
    >
      <StepEditorContent gameId={gameId} stepId={stepId} />
    </Suspense>
  );
}
