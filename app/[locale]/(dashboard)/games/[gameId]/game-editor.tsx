"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { AddStepMenu } from "@/components/dashboard/add-step-menu";
import { StepList } from "@/components/dashboard/step-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/routing";
import { updateGame } from "@/lib/actions/game";
import type { GameStep } from "@/lib/db/schema";

interface Game {
  description: string | null;
  id: string;
  steps: GameStep[];
  title: string;
}

interface Props {
  game: Game;
}

export function GameEditor({ game }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState(game.title);
  const [description, setDescription] = useState(game.description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateGame(game.id, {
        title,
        description: description || undefined,
      });
      toast.success("Saved!");
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <Button asChild size="sm" variant="ghost">
          <Link href="/dashboard">← {t("common.back")}</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border/50 bg-white p-6 shadow-sm">
        <div className="mb-5 border-primary border-l-4 pl-4">
          <h1 className="font-bold font-display text-xl">
            {t("gameEditor.title")}
          </h1>
        </div>
        <div className="max-w-xl space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="game-title">{t("gameEditor.gameTitleLabel")}</Label>
            <Input
              id="game-title"
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              value={title}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="game-desc">{t("gameEditor.gameDescLabel")}</Label>
            <Textarea
              id="game-desc"
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              value={description}
            />
          </div>
          <Button disabled={saving} onClick={handleSave} size="sm">
            {saving ? "Saving..." : t("gameEditor.saveGame")}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-semibold text-lg">Steps</h2>
            <Badge className="bg-primary/10 text-primary" variant="secondary">
              {game.steps.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/games/${game.id}/sessions`}>Manage sessions</Link>
            </Button>
            <AddStepMenu gameId={game.id} />
          </div>
        </div>

        <StepList gameId={game.id} steps={game.steps} />
      </div>
    </div>
  );
}
