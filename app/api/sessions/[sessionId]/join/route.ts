import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { gameParticipant, gameSession } from "@/lib/db/schema";
import { verifyInviteToken } from "@/lib/invite-token";
import { publish } from "@/lib/sse";
import { generateToken } from "@/lib/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, inviteToken } = body as {
    name?: string;
    inviteToken?: string;
  };

  if (!name || name.trim().length === 0) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  // Verify HMAC token if provided (for email invite links)
  if (inviteToken) {
    const valid = await verifyInviteToken(sessionId, name.trim(), inviteToken);
    if (!valid) {
      return Response.json({ error: "Invalid invite token" }, { status: 403 });
    }
  }

  const cookieStore = await cookies();
  const existingToken = cookieStore.get(`participant_${sessionId}`)?.value;

  // Check if participant is rejoining (same token AND same name)
  if (existingToken) {
    const [existing] = await db
      .select()
      .from(gameParticipant)
      .where(eq(gameParticipant.participantToken, existingToken));

    if (
      existing &&
      existing.sessionId === sessionId &&
      existing.name === name.trim()
    ) {
      const [gs] = await db
        .select()
        .from(gameSession)
        .where(eq(gameSession.id, sessionId));

      return Response.json({
        participantId: existing.id,
        name: existing.name,
        currentStepIndex: gs?.currentStepIndex ?? -1,
        sessionStatus: gs?.status ?? "waiting",
      });
    }
  }

  // Verify session exists and is joinable
  const [gs] = await db
    .select()
    .from(gameSession)
    .where(eq(gameSession.id, sessionId));

  if (!gs) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (gs.status === "finished") {
    return Response.json({ error: "Session has ended" }, { status: 400 });
  }

  const participantToken = generateToken();

  const [participant] = await db
    .insert(gameParticipant)
    .values({
      sessionId,
      name: name.trim(),
      participantToken,
    })
    .returning();

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  };

  cookieStore.set(`participant_${sessionId}`, participantToken, cookieOptions);

  publish(sessionId, {
    type: "participant_joined",
    data: { id: participant.id, name: participant.name },
  });

  return Response.json({
    participantId: participant.id,
    name: participant.name,
    currentStepIndex: gs.currentStepIndex,
    sessionStatus: gs.status,
  });
}

/** Resolve a join-by-code request */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const [gs] = await db
    .select()
    .from(gameSession)
    .where(eq(gameSession.id, sessionId));

  if (!gs) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  return Response.json({
    sessionId: gs.id,
    status: gs.status,
    inviteCode: gs.inviteCode,
  });
}
