"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useRouter } from "@/i18n/routing";
import { createSession } from "@/lib/actions/session";
import type { GameSession } from "@/lib/db/schema";
import { InviteEmailDialog } from "./invite-email-dialog";

interface Game {
  id: string;
  title: string;
}
interface Props {
  game: Game;
  sessions: GameSession[];
}

const statusConfig: Record<string, { border: string; badge: string }> = {
  waiting: {
    border: "border-t-amber-400",
    badge:
      "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  in_progress: {
    border: "border-t-emerald-400",
    badge:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  finished: {
    border: "border-t-muted",
    badge: "bg-muted text-muted-foreground",
  },
};

export function SessionManager({ game, sessions }: Props) {
  const t = useTranslations("session");
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const session = await createSession(game.id);
      router.push(`/host/session/${session.id}`);
    } catch {
      toast.error("Failed to create session");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          className="text-muted-foreground text-sm hover:text-foreground"
          href={`/games/${game.id}`}
        >
          ← {game.title}
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="font-bold font-display text-xl">Sessions</h1>
        <Button disabled={creating} onClick={handleCreate}>
          {creating ? "Creating..." : t("createSession")}
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-border/50 border-dashed py-16">
          <p className="text-muted-foreground text-sm">
            No sessions yet. Start one to run the game live!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const config = statusConfig[s.status] ?? statusConfig.finished;
            return (
              <Card
                className={`rounded-xl border-border/50 border-t-4 bg-white shadow-sm ${config.border}`}
                key={s.id}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-bold font-mono text-lg tracking-widest">
                      {s.inviteCode}
                    </CardTitle>
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-medium text-xs ${config.badge}`}
                    >
                      {t(`sessionStatus.${s.status}`)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center gap-2 pt-0">
                  <p className="flex-1 text-muted-foreground text-xs">
                    Created {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                  {s.status !== "finished" && (
                    <>
                      <InviteEmailDialog
                        gameId={game.id}
                        gameName={game.title}
                        session={s}
                      />
                      <Button asChild size="sm">
                        <Link href={`/host/session/${s.id}`}>
                          {s.status === "waiting" ? "Open" : "Rejoin"}
                        </Link>
                      </Button>
                    </>
                  )}
                  {s.status === "finished" && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/host/session/${s.id}/results`}>
                        {t("viewResults")}
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
