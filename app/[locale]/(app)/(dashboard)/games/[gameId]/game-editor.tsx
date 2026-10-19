"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { AddStepButton } from "@/components/dashboard/add-step-button";
import { ShareLinkCard } from "@/components/dashboard/share-link-card";
import { StepList, type StepSummary } from "@/components/dashboard/step-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/routing";
import { useLazyOpen } from "@/lib/use-lazy-open";

// The menu (Radix dropdown, positioning, scroll locking) loads after the
// editor shows, keeping it out of the initial JavaScript; until then the
// button is shown without it.
const AddStepMenu = lazy(() =>
  import("@/components/dashboard/add-step-menu").then((mod) => ({
    default: mod.AddStepMenu,
  }))
);

interface Game {
  _id: Id<"games">;
  description?: string;
  shareEnabled: boolean;
  shareToken: string | null;
  steps: StepSummary[];
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

/** Game editor page: breadcrumb, editable title and description, and the list of steps. */
export function GameEditor({ game }: Props) {
  const t = useTranslations();
  const addStepMenu = useLazyOpen();

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
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/80">
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

      <ShareLinkCard
        gameId={game._id}
        shareEnabled={game.shareEnabled}
        shareToken={game.shareToken}
      />

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
            <Suspense
              fallback={<AddStepButton {...addStepMenu.placeholderProps} />}
            >
              <AddStepMenu
                defaultOpen={addStepMenu.defaultOpen}
                gameId={game._id}
              />
            </Suspense>
          </div>
        </div>

        <StepList gameId={game._id} steps={game.steps} />
      </div>
    </div>
  );
}
