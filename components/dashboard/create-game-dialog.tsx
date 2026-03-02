"use client";

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
import { useRouter } from "@/i18n/routing";
import { createGame } from "@/lib/actions/game";

export function CreateGameDialog() {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value;
    const description = (
      form.elements.namedItem("description") as HTMLTextAreaElement
    ).value;

    try {
      const game = await createGame({
        title,
        description: description || undefined,
      });
      toast.success(t("dashboard.createSuccess"));
      setOpen(false);
      router.push(`/games/${game.id}`);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button>{t("dashboard.createGame")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dashboard.createGame")}</DialogTitle>
        </DialogHeader>
        <form className="mt-2 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="title">{t("gameEditor.gameTitleLabel")}</Label>
            <Input
              autoFocus
              id="title"
              maxLength={100}
              name="title"
              placeholder="e.g. Introduction to TypeScript"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">{t("gameEditor.gameDescLabel")}</Label>
            <Textarea
              id="description"
              maxLength={500}
              name="description"
              placeholder="A brief description of what you'll teach..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button disabled={loading} type="submit">
              {loading ? "Creating..." : t("common.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
