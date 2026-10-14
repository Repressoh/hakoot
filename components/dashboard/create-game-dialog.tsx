"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/routing";

export function CreateGameDialog() {
  const t = useTranslations();
  const { push } = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const createGame = useMutation(api.games.create);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value;
    const description = (
      form.elements.namedItem("description") as HTMLTextAreaElement
    ).value;
    const descriptionValue = description || undefined;

    try {
      const gameId = await createGame({
        description: descriptionValue,
        title,
      });
      toast.success(t("dashboard.createSuccess"));
      setLoading(false);
      setOpen(false);
      push(`/games/${gameId}`);
    } catch {
      setLoading(false);
      toast.error(t("common.error"));
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="press-down h-11 rounded-xl bg-primary px-5 font-bold font-display text-primary-foreground shadow-[0_0_15px_var(--glow-subtle)] transition hover:shadow-[0_0_25px_var(--glow-primary)] hover:brightness-110">
          <svg
            aria-hidden="true"
            className="mr-2"
            fill="none"
            height="16"
            viewBox="0 0 16 16"
            width="16"
          >
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>
          {t("dashboard.createGame")}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl border-border/60 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-bold font-display text-xl">
            {t("dashboard.createGame")}
          </DialogTitle>
        </DialogHeader>
        <form className="mt-3 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label
              className="font-medium text-foreground/80 text-sm"
              htmlFor="title"
            >
              {t("gameEditor.gameTitleLabel")}
            </Label>
            <Input
              className="h-11 rounded-xl border-border/60 bg-muted/40 text-foreground transition-colors placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
              id="title"
              maxLength={100}
              name="title"
              placeholder="e.g. Introduction to TypeScript"
              required
            />
          </div>
          <div className="space-y-2">
            <Label
              className="font-medium text-foreground/80 text-sm"
              htmlFor="description"
            >
              {t("gameEditor.gameDescLabel")}
            </Label>
            <Textarea
              className="rounded-xl border-border/60 bg-muted/40 text-foreground transition-colors placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
              id="description"
              maxLength={500}
              name="description"
              placeholder="A brief description of what you'll teach..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-1">
            <Button
              className="rounded-xl border-border/60 text-foreground hover:bg-muted/50"
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button
              className="glow-sm press-down rounded-xl bg-primary font-bold font-display text-primary-foreground hover:brightness-110"
              disabled={loading}
              type="submit"
            >
              {loading ? "Creating..." : t("common.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
