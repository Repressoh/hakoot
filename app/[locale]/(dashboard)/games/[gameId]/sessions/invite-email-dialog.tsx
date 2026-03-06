"use client";

import { useAction, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface InviteEntry {
  email: string;
  id: string;
  name: string;
}

interface Props {
  gameId: Id<"games">;
  gameName: string;
  session: { _id: Id<"gameSessions">; inviteCode: string };
}

export function InviteEmailDialog({ gameId, session, gameName }: Props) {
  const t = useTranslations("session");
  const locale = useLocale();
  const sendInvites = useAction(api.emails.sendInviteEmails);
  const emailLists = useQuery(api.emailLists.listWithEntries);

  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<InviteEntry[]>([
    { id: crypto.randomUUID(), name: "", email: "" },
  ]);
  const [sending, setSending] = useState(false);

  // List selection state
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [deselectedEntryIds, setDeselectedEntryIds] = useState<Set<string>>(
    new Set()
  );

  const selectedList =
    emailLists?.find((l) => l._id === selectedListId) ?? null;

  const handleSelectList = useCallback((value: string) => {
    if (value === "none") {
      setSelectedListId("");
      setDeselectedEntryIds(new Set());
    } else {
      setSelectedListId(value);
      setDeselectedEntryIds(new Set());
    }
  }, []);

  function toggleEntry(entryId: string) {
    setDeselectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }

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
    // Collect manual entries
    const manual = entries
      .filter((e) => e.name.trim() && e.email.trim())
      .map(({ name, email }) => ({ name, email }));

    // Collect selected list entries
    const fromList = selectedList
      ? selectedList.entries
          .filter((e) => !deselectedEntryIds.has(e._id))
          .map(({ name, email }) => ({ name, email }))
      : [];

    const valid = [...fromList, ...manual];
    if (valid.length === 0) {
      toast.error(t("noValidEntry"));
      return;
    }

    setSending(true);
    try {
      const result = await sendInvites({
        sessionId: session._id,
        gameId,
        invites: valid,
        locale,
      });
      toast.success(
        result.failed > 0
          ? t("sendSuccessPartial", { sent: result.sent, failed: result.failed })
          : t("sendSuccess", { sent: result.sent })
      );
      setOpen(false);
    } catch {
      toast.error(t("sendFailed"));
    } finally {
      setSending(false);
    }
  }

  const selectedFromListCount = selectedList
    ? selectedList.entries.length - deselectedEntryIds.size
    : 0;

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

          {/* ── Email list selector ──────────────────────────────────── */}
          {emailLists && emailLists.length > 0 && (
            <div className="space-y-2">
              <label className="font-medium text-foreground/80 text-sm">
                {t("fromList")}
              </label>
              <Select
                onValueChange={handleSelectList}
                value={selectedListId || "none"}
              >
                <SelectTrigger className="h-9 rounded-lg">
                  <SelectValue placeholder={t("selectList")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noList")}</SelectItem>
                  {emailLists.map((list) => (
                    <SelectItem key={list._id} value={list._id}>
                      {list.title} ({list.entries.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* ── Toggleable contacts from selected list ────────── */}
              {selectedList && selectedList.entries.length > 0 && (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-2">
                  <div className="flex items-center justify-between px-1 pb-1">
                    <span className="text-muted-foreground text-xs">
                      {selectedFromListCount}/{selectedList.entries.length}{" "}
                      selected
                    </span>
                    <button
                      className="text-primary text-xs hover:underline"
                      onClick={() => {
                        if (deselectedEntryIds.size === 0) {
                          setDeselectedEntryIds(
                            new Set(selectedList.entries.map((e) => e._id))
                          );
                        } else {
                          setDeselectedEntryIds(new Set());
                        }
                      }}
                      type="button"
                    >
                      {deselectedEntryIds.size === 0
                        ? t("deselectAll")
                        : t("selectAll")}
                    </button>
                  </div>
                  {selectedList.entries.map((entry) => {
                    const checked = !deselectedEntryIds.has(entry._id);
                    return (
                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                          checked
                            ? "bg-primary/8 text-foreground"
                            : "text-muted-foreground opacity-60"
                        } hover:bg-muted/50`}
                        key={entry._id}
                      >
                        <input
                          checked={checked}
                          className="h-3.5 w-3.5 rounded border-border accent-primary"
                          onChange={() => toggleEntry(entry._id)}
                          type="checkbox"
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {entry.name}
                        </span>
                        <span className="shrink-0 truncate font-mono text-muted-foreground text-xs">
                          {entry.email}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Manual entries ──────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="font-medium text-foreground/80 text-sm">
              {t("manualEntries")}
            </label>
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
