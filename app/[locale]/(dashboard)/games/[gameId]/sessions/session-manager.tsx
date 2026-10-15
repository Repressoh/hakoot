"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { type ComponentProps, lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link, useRouter } from "@/i18n/routing";
import { useLazyOpen } from "@/lib/use-lazy-open";
import { staggerDelay } from "@/lib/utils";

// The invite dialog (Radix dialog, select and tabs) loads after the list
// shows, keeping it out of the initial JavaScript; until then its button is
// shown without it.
const InviteEmailDialog = lazy(() =>
  import("./invite-email-dialog").then((mod) => ({
    default: mod.InviteEmailDialog,
  }))
);

interface Game {
  _id: Id<"games">;
  title: string;
}

interface Session {
  _creationTime: number;
  _id: Id<"gameSessions">;
  inviteCode: string;
  status: "waiting" | "in_progress" | "finished";
}

interface Props {
  game: Game;
  sessions: Session[];
}

const statusConfig: Record<
  string,
  { accent: string; badge: string; dot: string }
> = {
  finished: {
    accent: "border-l-muted-foreground/30",
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
  in_progress: {
    accent: "border-l-choice-green",
    badge: "bg-choice-green/15 text-choice-green",
    dot: "bg-choice-green animate-pulse",
  },
  waiting: {
    accent: "border-l-choice-yellow",
    badge: "bg-choice-yellow/15 text-choice-yellow",
    dot: "bg-choice-yellow",
  },
};

/** A session's "Send email invites" button and its dialog, which loads lazily. */
function InviteEmailsButton({
  gameId,
  gameName,
  session,
}: {
  gameId: Id<"games">;
  gameName: string;
  session: Session;
}) {
  const t = useTranslations("session");
  const dialog = useLazyOpen();
  const button = (props?: ComponentProps<typeof Button>) => (
    <Button size="sm" variant="outline" {...props}>
      {t("sendEmailInvites")}
    </Button>
  );
  return (
    <Suspense fallback={button(dialog.placeholderProps)}>
      <InviteEmailDialog
        defaultOpen={dialog.defaultOpen}
        gameId={gameId}
        gameName={gameName}
        session={session}
      >
        {button()}
      </InviteEmailDialog>
    </Suspense>
  );
}

/** Lists a game's sessions (with invite codes and email invites) and starts new ones. */
export function SessionManager({ game, sessions }: Props) {
  const t = useTranslations("session");
  const tNav = useTranslations("nav");
  const { push } = useRouter();
  const [creating, setCreating] = useState(false);
  const createSession = useMutation(api.sessions.create);

  async function handleCreate() {
    setCreating(true);
    try {
      const sessionId = await createSession({ gameId: game._id });
      push(`/host/session/${sessionId}`);
    } catch {
      toast.error("Failed to create session");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        <Link
          className="text-muted-foreground transition-colors hover:text-foreground"
          href="/dashboard"
        >
          {tNav("dashboard")}
        </Link>
        <span aria-hidden="true" className="text-muted-foreground/40">
          /
        </span>
        <Link
          className="max-w-[160px] truncate text-muted-foreground transition-colors hover:text-foreground"
          href={`/games/${game._id}`}
        >
          {game.title}
        </Link>
        <span aria-hidden="true" className="text-muted-foreground/40">
          /
        </span>
        <span className="font-medium text-foreground">Sessions</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display font-semibold text-2xl text-foreground">
            Sessions
          </h1>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/15 px-2 font-bold font-mono text-primary text-xs">
            {sessions.length}
          </span>
        </div>
        <Button
          className="press-down h-10 rounded-xl bg-primary px-5 font-bold font-display text-primary-foreground shadow-[0_0_15px_var(--glow-subtle)] transition hover:shadow-[0_0_25px_var(--glow-primary)] hover:brightness-110"
          disabled={creating}
          onClick={handleCreate}
        >
          {creating ? "Creating..." : t("createSession")}
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="fade-in slide-in-from-bottom-3 animation-duration-500 flex animate-in flex-col items-center justify-center rounded-2xl border-2 border-border/30 border-dashed bg-card/30 py-20 ease-out motion-reduce:animate-none">
          <div className="flex size-14 animate-float items-center justify-center rounded-2xl bg-primary/10 text-2xl shadow-[0_0_15px_var(--glow-subtle)]">
            📡
          </div>
          <p className="mt-4 font-bold font-display text-foreground">
            No sessions yet
          </p>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Start one to run the game live!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, i) => {
            const config = statusConfig[s.status] ?? statusConfig.finished;
            // No backdrop blur on cards in scrolling lists: behind their mostly opaque
            // background it made no visible difference, and on phones it left blank
            // tiles on screen during fast scrolls.
            return (
              <div
                className={`group rounded-2xl border border-border/60 border-l-4 ${config.accent} fade-in slide-in-from-bottom-3 animation-duration-350 animate-in bg-card/80 fill-mode-backwards p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-black/10 hover:shadow-lg motion-reduce:animate-none`}
                key={s._id}
                style={{ animationDelay: staggerDelay(i, 50) }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-bold font-mono text-lg text-primary tracking-widest">
                      {s.inviteCode}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium text-xs ${config.badge}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-1.5 rounded-full ${config.dot}`}
                      />
                      {t(`sessionStatus.${s.status}`)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <p
                    className="flex-1 font-mono text-muted-foreground text-xs"
                    suppressHydrationWarning
                  >
                    Created {Intl.DateTimeFormat().format(s._creationTime)}
                  </p>
                  {s.status !== "finished" && (
                    <>
                      <InviteEmailsButton
                        gameId={game._id}
                        gameName={game.title}
                        session={s}
                      />
                      <Button
                        asChild
                        className="press-down rounded-xl bg-primary/10 font-semibold text-primary transition-colors hover:bg-primary/20"
                        size="sm"
                      >
                        <Link href={`/host/session/${s._id}`}>
                          {s.status === "waiting" ? "Open" : "Rejoin"}
                        </Link>
                      </Button>
                    </>
                  )}
                  {s.status === "finished" && (
                    <Button
                      asChild
                      className="rounded-xl border-border/60 text-foreground transition-colors hover:bg-muted/50"
                      size="sm"
                      variant="outline"
                    >
                      <Link href={`/host/session/${s._id}/results`}>
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
