"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
    border: "border-t-choice-yellow",
    badge: "bg-choice-yellow/15 text-choice-yellow",
  },
  in_progress: {
    border: "border-t-choice-green",
    badge: "bg-choice-green/15 text-choice-green",
  },
  finished: {
    border: "border-t-border",
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
        <h1 className="font-bold font-display text-xl text-foreground">Sessions</h1>
        <Button
          className="rounded-xl bg-primary font-bold font-display text-primary-foreground glow-sm hover:brightness-110 press-down"
          disabled={creating}
          onClick={handleCreate}
        >
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
              <div
                className={`rounded-xl border border-border border-t-4 bg-card p-4 transition-all hover:glow-border ${config.border}`}
                key={s.id}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold font-mono text-lg text-primary tracking-widest">
                    {s.inviteCode}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-medium text-xs ${config.badge}`}
                  >
                    {t(`sessionStatus.${s.status}`)}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-0">
                  <p className="flex-1 text-muted-foreground text-xs font-mono">
                    Created {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                  {s.status !== "finished" && (
                    <>
                      <InviteEmailDialog
                        gameId={game.id}
                        gameName={game.title}
                        session={s}
                      />
                      <Button asChild size="sm" className="rounded-lg bg-primary/10 text-primary hover:bg-primary/20 press-down">
                        <Link href={`/host/session/${s.id}`}>
                          {s.status === "waiting" ? "Open" : "Rejoin"}
                        </Link>
                      </Button>
                    </>
                  )}
                  {s.status === "finished" && (
                    <Button asChild size="sm" variant="outline" className="rounded-lg border-border text-foreground hover:bg-muted/50">
                      <Link href={`/host/session/${s.id}/results`}>
                        {t("viewResults")}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
