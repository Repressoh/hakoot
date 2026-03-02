"use client";

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
import { useRouter } from "@/i18n/routing";
import { createQuizStep, createTheoryStep } from "@/lib/actions/step";

interface Props {
  gameId: string;
}

export function AddStepMenu({ gameId }: Props) {
  const t = useTranslations("gameEditor");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function addTheory() {
    setLoading(true);
    try {
      const step = await createTheoryStep(gameId, { markdownContent: "" });
      router.push(`/games/${gameId}/steps/${step.id}`);
    } catch {
      toast.error("Failed to create step");
      setLoading(false);
    }
  }

  async function addQuiz() {
    setLoading(true);
    try {
      const step = await createQuizStep(gameId, {
        question: "",
        choices: [
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
        ],
      });
      router.push(`/games/${gameId}/steps/${step.id}`);
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
