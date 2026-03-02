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
import type { GameSession } from "@/lib/db/schema";

interface InviteEntry {
  email: string;
  id: string;
  name: string;
}

interface Props {
  gameId: string;
  gameName: string;
  session: GameSession;
}

export function InviteEmailDialog({ gameId, session, gameName }: Props) {
  const t = useTranslations("session");
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<InviteEntry[]>([
    { id: crypto.randomUUID(), name: "", email: "" },
  ]);
  const [sending, setSending] = useState(false);

  function addEntry() {
    setEntries((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", email: "" },
    ]);
  }

  function updateEntry(i: number, field: keyof InviteEntry, value: string) {
    setEntries((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e))
    );
  }

  function removeEntry(i: number) {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSend() {
    const valid = entries
      .filter((e) => e.name.trim() && e.email.trim())
      .map(({ name, email }) => ({ name, email }));
    if (valid.length === 0) {
      toast.error("Add at least one valid entry");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/games/${gameId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, invites: valid }),
      });
      const data = await res.json();
      toast.success(
        `Sent ${data.sent} invite${data.sent !== 1 ? "s" : ""}${data.failed > 0 ? `, ${data.failed} failed` : ""}`
      );
      setOpen(false);
    } catch {
      toast.error("Failed to send invites");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t("sendEmailInvites")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("sendEmailInvites")}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <p className="text-muted-foreground text-sm">
            Each person will receive a personalized link to join{" "}
            <strong>{gameName}</strong>.
          </p>

          <div className="space-y-2">
            {entries.map((entry, i) => (
              <div className="flex items-start gap-2" key={entry.id}>
                <div className="flex-1 space-y-1">
                  <Input
                    aria-label={`Name ${i + 1}`}
                    onChange={(e) => updateEntry(i, "name", e.target.value)}
                    placeholder={t("namePlaceholder")}
                    value={entry.name}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Input
                    aria-label={`Email ${i + 1}`}
                    onChange={(e) => updateEntry(i, "email", e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    type="email"
                    value={entry.email}
                  />
                </div>
                {entries.length > 1 && (
                  <Button
                    aria-label="Remove"
                    className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeEntry(i)}
                    size="sm"
                    variant="ghost"
                  >
                    ×
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button onClick={addEntry} size="sm" type="button" variant="outline">
            + {t("addEmail")}
          </Button>

          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button disabled={sending} onClick={handleSend}>
              {sending ? "Sending..." : t("sendInvites")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
