"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { AddStepMenu } from "@/components/dashboard/add-step-menu";
import { StepList } from "@/components/dashboard/step-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/routing";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface Step {
  _id: Id<"gameSteps">;
  gameId: Id<"games">;
  order: number;
  type: "theory" | "quiz";
  markdownContent?: string;
  codeBlock?: { code: string; language: string; annotations: Array<{ label: string; explanation: string; lines: number[] }> };
  question?: string;
  choices?: Array<{ text: string; isCorrect: boolean }>;
  timeLimitSeconds?: number;
}

interface Game {
  _id: Id<"games">;
  description?: string;
  steps: Step[];
  title: string;
}

interface Props {
  game: Game;
}

export function GameEditor({ game }: Props) {
  const t = useTranslations();
  const [title, setTitle] = useState(game.title);
  const [description, setDescription] = useState(game.description ?? "");
  const [saving, setSaving] = useState(false);
  const updateGame = useMutation(api.games.update);

  async function handleSave() {
    setSaving(true);
    try {
      await updateGame({
        gameId: game._id,
        title,
        description: description || undefined,
      });
      toast.success("Saved!");
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-muted/50">
          <Link href="/dashboard">← {t("common.back")}</Link>
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 border-l-4 border-primary pl-4">
          <h1 className="font-bold font-display text-xl text-foreground">
            {t("gameEditor.title")}
          </h1>
        </div>
        <div className="max-w-xl space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="game-title" className="text-foreground/80 text-sm">{t("gameEditor.gameTitleLabel")}</Label>
            <Input
              className="h-11 rounded-xl border-border bg-muted/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
              id="game-title"
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              value={title}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="game-desc" className="text-foreground/80 text-sm">{t("gameEditor.gameDescLabel")}</Label>
            <Textarea
              className="rounded-xl border-border bg-muted/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
              id="game-desc"
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              value={description}
            />
          </div>
          <Button
            className="rounded-xl bg-primary font-bold font-display text-primary-foreground glow-sm hover:brightness-110 press-down"
            disabled={saving}
            onClick={handleSave}
            size="sm"
          >
            {saving ? "Saving..." : t("gameEditor.saveGame")}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-semibold text-lg text-foreground">Steps</h2>
            <span className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-0.5 font-mono text-primary text-xs">
              {game.steps.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="rounded-xl border-border text-foreground hover:bg-muted/50">
              <Link href={`/games/${game._id}/sessions`}>Manage sessions</Link>
            </Button>
            <AddStepMenu gameId={game._id} />
          </div>
        </div>

        <StepList gameId={game._id} steps={game.steps} />
      </div>
    </div>
  );
}
