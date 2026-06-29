"use node";

import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";
import { signInviteToken } from "./lib/inviteTokens";

/** Send in batches to respect Resend rate limits (10 req/s on free tier) */
const BATCH_SIZE = 8;
const BATCH_DELAY_MS = 1200; // ~1.2s between batches
const MAX_INVITES_PER_CALL = 50;
const SUPPORTED_LOCALES = new Set(["en", "it"]);
const TRAILING_SLASHES_REGEX = /\/+$/;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeLocale(locale?: string): string {
  return locale && SUPPORTED_LOCALES.has(locale) ? locale : "en";
}

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
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const locale = normalizeLocale(args.locale);

    if (args.invites.length === 0) {
      return { sent: 0, failed: 0 };
    }
    if (args.invites.length > MAX_INVITES_PER_CALL) {
      throw new Error(
        `Cannot send more than ${MAX_INVITES_PER_CALL} invites at once`
      );
    }

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
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(
      TRAILING_SLASHES_REGEX,
      ""
    );
    const gameName = sessionData.game?.title ?? "Hakoot Game";
    const isItalian = locale === "it";
    const hostName = isItalian ? "Il tuo host" : "Your host";

    let sent = 0;
    let failed = 0;

    // Split into batches to avoid Resend rate limits
    for (
      let batchStart = 0;
      batchStart < args.invites.length;
      batchStart += BATCH_SIZE
    ) {
      const batch = args.invites.slice(batchStart, batchStart + BATCH_SIZE);

      // Wait between batches (not before the first one)
      if (batchStart > 0) {
        await sleep(BATCH_DELAY_MS);
      }

      await Promise.allSettled(
        batch.map(async (invite) => {
          try {
            const inviteToken = await signInviteToken(
              args.sessionId,
              invite.name
            );
            const joinUrl = `${appUrl}/${locale}/join?session=${encodeURIComponent(args.sessionId)}&name=${encodeURIComponent(invite.name)}&token=${encodeURIComponent(inviteToken)}`;

            await resend.emails.send({
              from: fromEmail,
              to: invite.email,
              subject: isItalian
                ? `${hostName} ti ha invitato a unirti a "${gameName}" su Hakoot`
                : `${hostName} invited you to join "${gameName}" on Hakoot`,
              html: buildInviteEmailHtml({
                recipientName: invite.name,
                hostName,
                gameName,
                joinUrl,
                inviteCode: sessionData.session.inviteCode,
                locale,
              }),
            });
            sent++;
          } catch {
            failed++;
          }
        })
      );
    }

    return { sent, failed };
  },
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildInviteEmailHtml({
  recipientName,
  hostName,
  gameName,
  joinUrl,
  inviteCode,
  locale,
}: {
  recipientName: string;
  hostName: string;
  gameName: string;
  joinUrl: string;
  inviteCode: string;
  locale: string;
}) {
  const isIt = locale === "it";
  const safeName = escapeHtml(recipientName);
  const safeHost = escapeHtml(hostName);
  const safeGame = escapeHtml(gameName);
  const safeCode = escapeHtml(inviteCode);
  const safeJoinUrl = escapeHtml(joinUrl);
  const subtitle = isIt ? "Invito di apprendimento" : "Learning invitation";
  const greeting = isIt ? `Ciao ${safeName}!` : `Hi ${safeName}!`;
  const body = isIt
    ? `<strong>${safeHost}</strong> ti ha invitato a unirti a: <strong>&ldquo;${safeGame}&rdquo;</strong>.`
    : `<strong>${safeHost}</strong> invited you to join: <strong>&ldquo;${safeGame}&rdquo;</strong>.`;
  const codeLabel = isIt ? "Il tuo codice d'invito" : "Your invite code";
  const btnLabel = isIt ? "Unisciti al gioco \u2192" : "Join game \u2192";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${isIt ? `Unisciti a ${safeGame} su Hakoot` : `Join ${safeGame} on Hakoot`}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${subtitle}</p>
              <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#111827;">${greeting}</h1>
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">
                ${body}
              </p>
              <div style="margin:0 0 24px;padding:20px;background:#f3f4f6;border-radius:8px;text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">${codeLabel}</p>
                <p style="margin:0;font-size:32px;font-weight:800;color:#111827;letter-spacing:.15em;">${safeCode}</p>
              </div>
              <a href="${safeJoinUrl}" style="display:block;text-align:center;background:#111827;color:#ffffff;padding:14px 24px;border-radius:8px;font-size:16px;font-weight:600;text-decoration:none;">${btnLabel}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
