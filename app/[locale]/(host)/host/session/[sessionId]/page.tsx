import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import { redirect } from "@/i18n/routing";
import { getSession as getAuthSession } from "@/lib/actions/auth";
import { db } from "@/lib/db";
import { game, gameParticipant, gameSession, gameStep } from "@/lib/db/schema";
import { HostSessionView } from "./host-session-view";

interface Props {
  params: Promise<{ sessionId: string }>;
}

async function HostSessionContent({ sessionId }: { sessionId: string }) {
  const authSession = await getAuthSession();
  const locale = await getLocale();

  if (!authSession) {
    redirect({ href: "/sign-in", locale });
  }

  const [gs] = await db
    .select()
    .from(gameSession)
    .where(
      and(
        eq(gameSession.id, sessionId),
        // biome-ignore lint/style/noNonNullAssertion: redirect() above guarantees non-null
        eq(gameSession.hostId, authSession!.user.id)
      )
    );

  if (!gs) {
    notFound();
  }

  const [g] = await db.select().from(game).where(eq(game.id, gs.gameId));
  const steps = await db
    .select()
    .from(gameStep)
    .where(eq(gameStep.gameId, gs.gameId))
    .orderBy(gameStep.order);
  const participants = await db
    .select()
    .from(gameParticipant)
    .where(eq(gameParticipant.sessionId, sessionId));

  return (
    <HostSessionView
      game={g}
      initialParticipants={participants}
      session={gs}
      steps={steps}
    />
  );
}

export default async function HostSessionPage({ params }: Props) {
  const { sessionId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      }
    >
      <HostSessionContent sessionId={sessionId} />
    </Suspense>
  );
}
