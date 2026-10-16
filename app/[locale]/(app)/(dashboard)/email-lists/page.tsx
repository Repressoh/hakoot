"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCachedQuery } from "@/lib/use-cached-query";

// ─── Create list dialog ────────────────────────────────────────────────

/** Dialog for creating a new, empty email list. */
function CreateListDialog() {
  const t = useTranslations("emailLists");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const createList = useMutation(api.emailLists.create);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = (
      e.currentTarget.elements.namedItem("title") as HTMLInputElement
    ).value.trim();
    if (!title) {
      return;
    }

    setLoading(true);
    try {
      await createList({ title });
      toast.success(t("createSuccess"));
      setLoading(false);
      setOpen(false);
    } catch {
      setLoading(false);
      toast.error("Something went wrong");
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
          {t("createList")}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl border-border/60 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-bold font-display text-xl">
            {t("createList")}
          </DialogTitle>
        </DialogHeader>
        <form className="mt-3 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label
              className="font-medium text-foreground/80 text-sm"
              htmlFor="title"
            >
              {t("listTitle")}
            </Label>
            <Input
              className="h-11 rounded-xl border-border/60 bg-muted/40 text-foreground transition-colors placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
              id="title"
              maxLength={100}
              name="title"
              placeholder={t("listTitlePlaceholder")}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={loading} type="submit">
              {loading ? "Creating..." : t("createList")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add entry form ─────────────────────────────────────────────────────

/** Inline form that adds a name and email address to the list `listId`. */
function AddEntryForm({ listId }: { listId: Id<"emailLists"> }) {
  const t = useTranslations("emailLists");
  const addEntry = useMutation(api.emailLists.addEntry);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!(name.trim() && email.trim())) {
      return;
    }
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    setName("");
    setEmail("");
    addEntry({ email: trimmedEmail, listId, name: trimmedName }).catch(() => {
      toast.error("Failed to add entry");
    });
  }

  return (
    <form className="flex items-end gap-2" onSubmit={handleAdd}>
      <div className="flex-1">
        <Input
          aria-label={t("entryName")}
          className="h-9 rounded-lg border-border/60 bg-muted/40"
          onChange={(e) => setName(e.target.value)}
          placeholder={t("entryNamePlaceholder")}
          required
          value={name}
        />
      </div>
      <div className="flex-1">
        <Input
          aria-label={t("entryEmail")}
          className="h-9 rounded-lg border-border/60 bg-muted/40"
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("entryEmailPlaceholder")}
          required
          type="email"
          value={email}
        />
      </div>
      <Button className="h-9 rounded-lg" size="sm" type="submit">
        {t("addEntry")}
      </Button>
    </form>
  );
}

// ─── Single list card ──────────────────────────────────────────────────

/**
 * Expandable card for one email list: its entries, plus controls to add or remove entries and
 * delete the list.
 */
function EmailListCard({
  list,
}: {
  list: {
    _id: Id<"emailLists">;
    title: string;
    entries: Array<{
      _id: Id<"emailListEntries">;
      name: string;
      email: string;
    }>;
  };
}) {
  const t = useTranslations("emailLists");
  const removeList = useMutation(api.emailLists.remove);
  const removeEntry = useMutation(api.emailLists.removeEntry);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group rounded-2xl border border-border/50 bg-card/60 p-5 transition hover:border-border/80 hover:shadow-black/5 hover:shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <button
          className="flex flex-1 items-center gap-3 text-left"
          onClick={() => setExpanded(!expanded)}
          type="button"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 font-bold font-mono text-primary text-sm">
            {list.entries.length}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display font-semibold text-foreground">
              {list.title}
            </h3>
            <p className="text-muted-foreground text-xs">
              {list.entries.length}{" "}
              {list.entries.length === 1 ? "contact" : "contacts"}
            </p>
          </div>
          <svg
            aria-hidden="true"
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              aria-label="Delete list"
              className="size-8 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              size="sm"
              variant="ghost"
            >
              ×
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
              <AlertDialogDescription>{t("deleteDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  try {
                    await removeList({ listId: list._id });
                    toast.success(t("deleteSuccess"));
                  } catch {
                    toast.error(t("deleteFailed"));
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-3">
          {list.entries.length > 0 && (
            <div className="space-y-1.5">
              {list.entries.map((entry) => (
                <div
                  className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm"
                  key={entry._id}
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {entry.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground text-xs">
                    {entry.email}
                  </span>
                  <Button
                    aria-label="Remove entry"
                    className="size-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      removeEntry({ entryId: entry._id }).catch(() =>
                        toast.error(t("removeEntryFailed"))
                      )
                    }
                    size="sm"
                    variant="ghost"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}
          <AddEntryForm listId={list._id} />
        </div>
      ) : null}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────

export default function EmailListsPage() {
  const t = useTranslations("emailLists");
  const lists = useCachedQuery(api.emailLists.listWithEntries);

  if (lists === undefined) {
    return (
      <div className="space-y-10">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2.5">
            <Skeleton className="h-8 w-56 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
        <div className="space-y-4">
          {["a", "b"].map((id) => (
            <Skeleton className="h-20 rounded-2xl" key={id} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="font-display font-semibold text-3xl text-foreground tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {lists.length === 0
              ? t("emptyDesc")
              : `${lists.length} ${lists.length === 1 ? "list" : "lists"}`}
          </p>
        </div>
        <CreateListDialog />
      </div>

      {lists.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/50 border-dashed bg-card/30 py-16 text-center">
          <p className="text-muted-foreground text-sm">{t("emptyDesc")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {lists.map((list) => (
            <EmailListCard key={list._id} list={list} />
          ))}
        </div>
      )}
    </div>
  );
}
