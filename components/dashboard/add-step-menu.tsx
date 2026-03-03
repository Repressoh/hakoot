"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "@/i18n/routing";

interface Props {
  gameId: Id<"games">;
}

export function AddStepMenu({ gameId }: Props) {
  const t = useTranslations("gameEditor");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const createTheory = useMutation(api.steps.createTheory);
  const createQuiz = useMutation(api.steps.createQuiz);

  async function addTheory() {
    setLoading(true);
    try {
      const stepId = await createTheory({ gameId, markdownContent: "" });
      router.push(`/games/${gameId}/steps/${stepId}`);
    } catch {
      toast.error("Failed to create step");
      setLoading(false);
    }
  }

  async function addQuiz() {
    setLoading(true);
    try {
      const stepId = await createQuiz({
        gameId,
        question: "",
        choices: [
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
        ],
      });
      router.push(`/games/${gameId}/steps/${stepId}`);
    } catch {
      toast.error("Failed to create step");
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={loading} size="sm">
          + {t("addStep")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={addTheory}>
          📖 {t("addTheoryStep")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={addQuiz}>
          ❓ {t("addQuizStep")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
