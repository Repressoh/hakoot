import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { game, gameSession } from "@/lib/db/schema";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.toUpperCase().trim();

  if (!code) {
    return Response.json({ error: "Missing code" }, { status: 400 });
  }

  const [row] = await db
    .select({
      id: gameSession.id,
      status: gameSession.status,
      inviteCode: gameSession.inviteCode,
      gameTitle: game.title,
    })
    .from(gameSession)
    .innerJoin(game, eq(gameSession.gameId, game.id))
    .where(eq(gameSession.inviteCode, code));

  if (!row) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (row.status === "finished") {
    return Response.json({ error: "Session has ended" }, { status: 400 });
  }

  return Response.json(row);
}
