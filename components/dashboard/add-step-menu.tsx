"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "@/i18n/routing";
import { AddStepButton } from "./add-step-button";

interface Props {
  gameId: Id<"games">;
}

/** Menu that adds a theory or quiz step to the game and opens its editor. */
export function AddStepMenu({ gameId }: Props) {
  const t = useTranslations("gameEditor");
  const { push } = useRouter();
  const [loading, setLoading] = useState(false);
  const createTheory = useMutation(api.steps.createTheory);
  const createQuiz = useMutation(api.steps.createQuiz);

  async function addTheory() {
    setLoading(true);
    try {
      const stepId = await createTheory({ gameId, markdownContent: "" });
      push(`/games/${gameId}/steps/${stepId}`);
    } catch {
      setLoading(false);
      toast.error("Failed to create step");
    }
  }

  async function addQuiz() {
    setLoading(true);
    try {
      const stepId = await createQuiz({
        choices: [
          { isCorrect: false, text: "" },
          { isCorrect: false, text: "" },
          { isCorrect: false, text: "" },
          { isCorrect: false, text: "" },
        ],
        gameId,
        question: "",
      });
      push(`/games/${gameId}/steps/${stepId}`);
    } catch {
      setLoading(false);
      toast.error("Failed to create step");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <AddStepButton disabled={loading} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="rounded-xl border-border/60 bg-card/95 shadow-black/20 shadow-xl backdrop-blur-xl"
      >
        <DropdownMenuItem className="mx-1 gap-2 rounded-lg" onClick={addTheory}>
          <span className="flex size-6 items-center justify-center rounded-md bg-choice-blue/15 text-xs">
            📖
          </span>
          {t("addTheoryStep")}
        </DropdownMenuItem>
        <DropdownMenuItem className="mx-1 gap-2 rounded-lg" onClick={addQuiz}>
          <span className="flex size-6 items-center justify-center rounded-md bg-choice-yellow/15 text-xs">
            ❓
          </span>
          {t("addQuizStep")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
