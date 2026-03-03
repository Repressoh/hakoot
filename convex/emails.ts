"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const sendInviteEmails = action({
  args: {
    gameId: v.id("games"),
    sessionId: v.id("gameSessions"),
    invites: v.array(
      v.object({
        name: v.string(),
        email: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Verify session exists via query
    const sessionData = await ctx.runQuery(api.sessions.getForHost, {
      sessionId: args.sessionId,
    });

    if (!sessionData) {
      return { sent: 0, failed: args.invites.length };
    }

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@hakoot.app";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const gameName = sessionData.game?.title ?? "Hakoot Game";
    const hostName = "Your host";

    let sent = 0;
    let failed = 0;

    for (const invite of args.invites) {
      try {
        // Sign invite token using HMAC
        const inviteToken = await signInviteToken(
          args.sessionId,
          invite.name
        );
        const joinUrl = `${appUrl}/en/join?session=${args.sessionId}&name=${encodeURIComponent(invite.name)}&token=${inviteToken}`;

        await resend.emails.send({
          from: fromEmail,
          to: invite.email,
          subject: `${hostName} invited you to join "${gameName}" on Hakoot`,
          html: buildInviteEmailHtml({
            recipientName: invite.name,
            hostName,
            gameName,
            joinUrl,
            inviteCode: sessionData.session.inviteCode,
          }),
        });
        sent++;
      } catch {
        failed++;
      }
    }

    return { sent, failed };
  },
});

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.INVITE_HMAC_SECRET ?? "";
  const keyMaterial = new TextEncoder().encode(secret);
  return await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function signInviteToken(
  sessionId: string,
  name: string
): Promise<string> {
  const key = await getKey();
  const data = new TextEncoder().encode(`${sessionId}:${name}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return Buffer.from(sig).toString("base64url");
}

function buildInviteEmailHtml({
  recipientName,
  hostName,
  gameName,
  joinUrl,
  inviteCode,
}: {
  recipientName: string;
  hostName: string;
  gameName: string;
  joinUrl: string;
  inviteCode: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Join ${gameName} on Hakoot</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Learning invitation</p>
              <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#111827;">Hi ${recipientName}!</h1>
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">
                <strong>${hostName}</strong> invited you to join: <strong>&ldquo;${gameName}&rdquo;</strong>.
              </p>
              <div style="margin:0 0 24px;padding:20px;background:#f3f4f6;border-radius:8px;text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Your invite code</p>
                <p style="margin:0;font-size:32px;font-weight:800;color:#111827;letter-spacing:.15em;">${inviteCode}</p>
              </div>
              <a href="${joinUrl}" style="display:block;text-align:center;background:#111827;color:#ffffff;padding:14px 24px;border-radius:8px;font-size:16px;font-weight:600;text-decoration:none;">Join game →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
