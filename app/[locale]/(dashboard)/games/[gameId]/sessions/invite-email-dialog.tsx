"use client";

import { useAction, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useReducer } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface InviteEntry {
  email: string;
  id: string;
  name: string;
}

interface Props {
  children: React.ReactNode;
  gameId: Id<"games">;
  gameName: string;
  session: { _id: Id<"gameSessions">; inviteCode: string };
}

interface State {
  checkedEntryIds: Set<string>;
  entries: InviteEntry[];
  open: boolean;
  selectedListId: string;
  sending: boolean;
}

type Action =
  | { type: "SET_OPEN"; open: boolean }
  | { type: "ADD_ENTRY" }
  | {
      type: "UPDATE_ENTRY";
      index: number;
      field: keyof InviteEntry;
      value: string;
    }
  | { type: "REMOVE_ENTRY"; index: number }
  | { type: "SET_LIST"; listId: string; entryIds: string[] }
  | { type: "TOGGLE_ENTRY"; entryId: string }
  | { type: "SELECT_ALL"; entryIds: string[] }
  | { type: "DESELECT_ALL" }
  | { type: "SET_SENDING"; sending: boolean };

const initialState: State = {
  checkedEntryIds: new Set(),
  entries: [{ email: "", id: crypto.randomUUID(), name: "" }],
  open: false,
  selectedListId: "",
  sending: false,
};

/**
 * State transitions for the invite dialog: recipient rows, the chosen email list and sending
 * status.
 */
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_OPEN":
      return { ...state, open: action.open };
    case "ADD_ENTRY":
      return {
        ...state,
        entries: [
          ...state.entries,
          { email: "", id: crypto.randomUUID(), name: "" },
        ],
      };
    case "UPDATE_ENTRY":
      return {
        ...state,
        entries: state.entries.map((e, i) =>
          i === action.index ? { ...e, [action.field]: action.value } : e
        ),
      };
    case "REMOVE_ENTRY":
      return {
        ...state,
        entries: state.entries.filter((_, i) => i !== action.index),
      };
    case "SET_LIST":
      return {
        ...state,
        checkedEntryIds: new Set(action.entryIds),
        selectedListId: action.listId,
      };
    case "TOGGLE_ENTRY": {
      const next = new Set(state.checkedEntryIds);
      if (next.has(action.entryId)) {
        next.delete(action.entryId);
      } else {
        next.add(action.entryId);
      }
      return { ...state, checkedEntryIds: next };
    }
    case "SELECT_ALL":
      return { ...state, checkedEntryIds: new Set(action.entryIds) };
    case "DESELECT_ALL":
      return { ...state, checkedEntryIds: new Set() };
    case "SET_SENDING":
      return { ...state, sending: action.sending };
    default:
      return state;
  }
}

/**
 * Dialog for emailing session invites to recipients typed in by hand or picked from a saved email
 * list. Opened by `children`, the trigger button.
 */
export function InviteEmailDialog({
  children,
  gameId,
  session,
  gameName,
}: Props) {
  const t = useTranslations("session");
  const locale = useLocale();
  const sendInvites = useAction(api.emails.sendInviteEmails);
  const [state, dispatch] = useReducer(reducer, initialState);
  const { open, entries, sending, selectedListId, checkedEntryIds } = state;
  // Saved lists (with all their addresses) are only needed while the dialog is
  // open; the sessions page renders one dialog per open session.
  const emailLists = useQuery(
    api.emailLists.listWithEntries,
    open ? {} : "skip"
  );

  const selectedList = emailLists?.find((l) => l._id === selectedListId);

  function addEntry() {
    dispatch({ type: "ADD_ENTRY" });
  }

  function updateEntry(i: number, field: keyof InviteEntry, value: string) {
    dispatch({ field, index: i, type: "UPDATE_ENTRY", value });
  }

  function removeEntry(i: number) {
    dispatch({ index: i, type: "REMOVE_ENTRY" });
  }

  function handleListChange(listId: string) {
    const list = emailLists?.find((l) => l._id === listId);
    dispatch({
      entryIds: list ? list.entries.map((e) => e._id) : [],
      listId,
      type: "SET_LIST",
    });
  }

  function toggleEntry(entryId: string) {
    dispatch({ entryId, type: "TOGGLE_ENTRY" });
  }

  function selectAll() {
    if (selectedList) {
      dispatch({
        entryIds: selectedList.entries.map((e) => e._id),
        type: "SELECT_ALL",
      });
    }
  }

  function deselectAll() {
    dispatch({ type: "DESELECT_ALL" });
  }

  async function handleSend() {
    const manualValid = entries.reduce<Array<{ name: string; email: string }>>(
      (acc, { name, email }) => {
        if (name.trim() && email.trim()) {
          acc.push({ email, name });
        }
        return acc;
      },
      []
    );

    const listValid = selectedList
      ? selectedList.entries.reduce<Array<{ name: string; email: string }>>(
          (acc, { _id, name, email }) => {
            if (checkedEntryIds.has(_id)) {
              acc.push({ email, name });
            }
            return acc;
          },
          []
        )
      : [];

    const seen = new Set<string>();
    const valid = [...manualValid, ...listValid].filter(({ email }) => {
      const key = email.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    if (valid.length === 0) {
      toast.error(t("noValidEntry"));
      return;
    }

    dispatch({ sending: true, type: "SET_SENDING" });
    try {
      const result = await sendInvites({
        gameId,
        invites: valid,
        locale,
        sessionId: session._id,
      });
      let successMsg: string;
      if (result.failed > 0) {
        successMsg = t("sendSuccessPartial", {
          failed: result.failed,
          sent: result.sent,
        });
      } else {
        successMsg = t("sendSuccess", { sent: result.sent });
      }
      toast.success(successMsg);
      dispatch({ sending: false, type: "SET_SENDING" });
      dispatch({ open: false, type: "SET_OPEN" });
    } catch {
      toast.error(t("sendFailed"));
      dispatch({ sending: false, type: "SET_SENDING" });
    }
  }

  return (
    <Dialog
      onOpenChange={(o) => dispatch({ open: o, type: "SET_OPEN" })}
      open={open}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("sendEmailInvites")}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <p className="text-muted-foreground text-sm">
            Each person will receive a personalized link to join{" "}
            <strong>{gameName}</strong>.
          </p>

          <Tabs defaultValue="manual">
            <TabsList>
              <TabsTrigger value="manual">{t("manualEntries")}</TabsTrigger>
              <TabsTrigger value="list">{t("fromList")}</TabsTrigger>
            </TabsList>

            <TabsContent className="mt-3 space-y-2" value="manual">
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
                      className="size-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeEntry(i)}
                      size="sm"
                      variant="ghost"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
              <Button
                onClick={addEntry}
                size="sm"
                type="button"
                variant="outline"
              >
                + {t("addEmail")}
              </Button>
            </TabsContent>

            <TabsContent className="mt-3 space-y-3" value="list">
              <Select onValueChange={handleListChange} value={selectedListId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectList")} />
                </SelectTrigger>
                <SelectContent>
                  {(emailLists ?? []).map((list) => (
                    <SelectItem key={list._id} value={list._id}>
                      {list.title} ({list.entries.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedList && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">
                      {checkedEntryIds.size} / {selectedList.entries.length}{" "}
                      selected
                    </span>
                    <div className="flex gap-1">
                      <Button
                        className="h-7 px-2 text-xs"
                        onClick={selectAll}
                        size="sm"
                        variant="ghost"
                      >
                        {t("selectAll")}
                      </Button>
                      <Button
                        className="h-7 px-2 text-xs"
                        onClick={deselectAll}
                        size="sm"
                        variant="ghost"
                      >
                        {t("deselectAll")}
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-52 divide-y overflow-y-auto rounded-md border">
                    {selectedList.entries.map((entry) => (
                      <label
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50"
                        htmlFor={String(entry._id)}
                        key={entry._id}
                      >
                        <Checkbox
                          checked={checkedEntryIds.has(entry._id)}
                          id={String(entry._id)}
                          onCheckedChange={() => toggleEntry(entry._id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-sm">
                            {entry.name}
                          </p>
                          <p className="truncate text-muted-foreground text-xs">
                            {entry.email}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => dispatch({ open: false, type: "SET_OPEN" })}
              variant="outline"
            >
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
