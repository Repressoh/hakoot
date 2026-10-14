"use client";

import { useMutation } from "convex/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { AddStepMenu } from "@/components/dashboard/add-step-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/routing";

const StepList = dynamic(
  () => import("@/components/dashboard/step-list").then((mod) => mod.StepList),
  {
    loading: () => (
      <div className="animate-pulse space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    ),
    ssr: false,
  }
);

interface Step {
  _id: Id<"gameSteps">;
  choices?: Array<{ text: string; isCorrect: boolean }>;
  codeBlock?: {
    code: string;
    language: string;
    annotations: Array<{ label: string; explanation: string; lines: number[] }>;
  };
  gameId: Id<"games">;
  markdownContent?: string;
  order: number;
  question?: string;
  timeLimitSeconds?: number;
  type: "theory" | "quiz";
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

interface GameDetailsFormProps {
  gameId: Id<"games">;
  initialDescription: string;
  initialTitle: string;
}

/** Editable copy of the title/description. Render with a `key` derived from
 * the saved values so the form resets when they change on the server. */
function GameDetailsForm({
  gameId,
  initialDescription,
  initialTitle,
}: GameDetailsFormProps) {
  const t = useTranslations();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const updateGame = useMutation(api.games.update);

  async function handleSave() {
    setSaving(true);
    const descriptionValue = description || undefined;
    try {
      await updateGame({
        description: descriptionValue,
        gameId,
        title,
      });
      toast.success("Saved!");
      setSaving(false);
    } catch {
      setSaving(false);
      toast.error(t("common.error"));
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label
          className="font-medium text-foreground/80 text-sm"
          htmlFor="game-title"
        >
          {t("gameEditor.gameTitleLabel")}
        </Label>
        <Input
          className="h-11 rounded-xl border-border/60 bg-muted/40 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
          id="game-title"
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
          value={title}
        />
      </div>
      <div className="space-y-2">
        <Label
          className="font-medium text-foreground/80 text-sm"
          htmlFor="game-desc"
        >
          {t("gameEditor.gameDescLabel")}
        </Label>
        <Textarea
          className="rounded-xl border-border/60 bg-muted/40 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
          id="game-desc"
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          value={description}
        />
      </div>
      <Button
        className="glow-sm press-down rounded-xl bg-primary font-bold font-display text-primary-foreground hover:brightness-110"
        disabled={saving}
        onClick={handleSave}
        size="sm"
      >
        {saving ? "Saving..." : t("gameEditor.saveGame")}
      </Button>
    </div>
  );
}

export function GameEditor({ game }: Props) {
  const t = useTranslations();

  return (
    <div className="space-y-8">
      {/* Breadcrumb nav */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        <Link
          className="text-muted-foreground transition-colors hover:text-foreground"
          href="/dashboard"
        >
          {t("nav.dashboard")}
        </Link>
        <span aria-hidden="true" className="text-muted-foreground/40">
          /
        </span>
        <span className="max-w-[200px] truncate font-medium text-foreground">
          {game.title}
        </span>
      </nav>

      {/* Game details card */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm">
        {/* Accent bar */}
        <div
          aria-hidden="true"
          className="h-1 bg-gradient-to-r from-primary/60 via-accent/40 to-primary/60"
        />

        <div className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-lg text-primary">
              🎮
            </div>
            <h1 className="font-display font-semibold text-foreground text-xl">
              {t("gameEditor.title")}
            </h1>
          </div>

          <GameDetailsForm
            gameId={game._id}
            initialDescription={game.description ?? ""}
            initialTitle={game.title}
            key={`${game.title}\n${game.description ?? ""}`}
          />
        </div>
      </div>

      {/* Steps section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-display font-semibold text-foreground text-lg">
              Steps
            </h2>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/15 px-2 font-bold font-mono text-primary text-xs shadow-[0_0_8px_var(--glow-subtle)]">
              {game.steps.length}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              asChild
              className="rounded-xl border-border/60 text-foreground hover:bg-muted/50"
              size="sm"
              variant="outline"
            >
              <Link href={`/games/${game._id}/sessions`}>Sessions</Link>
            </Button>
            <AddStepMenu gameId={game._id} />
          </div>
        </div>

        <StepList gameId={game._id} steps={game.steps} />
      </div>
    </div>
  );
}
