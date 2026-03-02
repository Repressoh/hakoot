import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game, gameSession } from "@/lib/db/schema";
import { sendInviteEmail } from "@/lib/email";
import { signInviteToken } from "@/lib/invite-token";

interface InviteEntry {
  email: string;
  name: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const authSession = await auth.api.getSession({ headers: await headers() });
  if (!authSession) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { sessionId, invites } = body as {
    sessionId: string;
    invites: InviteEntry[];
  };

  if (!(sessionId && Array.isArray(invites)) || invites.length === 0) {
    return Response.json(
      { error: "Missing sessionId or invites" },
      { status: 400 }
    );
  }

  const [g] = await db
    .select()
    .from(game)
    .where(and(eq(game.id, gameId), eq(game.createdById, authSession.user.id)));

  if (!g) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }

  const [gs] = await db
    .select()
    .from(gameSession)
    .where(
      and(
        eq(gameSession.id, sessionId),
        eq(gameSession.hostId, authSession.user.id)
      )
    );

  if (!gs) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const results = await Promise.allSettled(
    invites.map(async (invite) => {
      const token = await signInviteToken(sessionId, invite.name);
      const joinUrl = `${appUrl}/en/join?session=${sessionId}&name=${encodeURIComponent(invite.name)}&token=${token}`;

      return sendInviteEmail({
        to: invite.email,
        recipientName: invite.name,
        hostName: authSession.user.name,
        gameName: g.title,
        joinUrl,
        inviteCode: gs.inviteCode,
      });
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return Response.json({ sent, failed });
}
