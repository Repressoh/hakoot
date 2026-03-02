import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@hakoot.app";

interface InviteEmailProps {
  gameName: string;
  hostName: string;
  inviteCode: string;
  joinUrl: string;
  recipientName: string;
  to: string;
}

export async function sendInviteEmail({
  to,
  recipientName,
  hostName,
  gameName,
  joinUrl,
  inviteCode,
}: InviteEmailProps): Promise<{ success: boolean; error?: string }> {
  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: `${hostName} invited you to join "${gameName}" on Hakoot`,
      html: buildInviteEmailHtml({
        recipientName,
        hostName,
        gameName,
        joinUrl,
        inviteCode,
      }),
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function buildInviteEmailHtml({
  recipientName,
  hostName,
  gameName,
  joinUrl,
  inviteCode,
}: Omit<InviteEmailProps, "to">) {
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
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Learning invitation</p>
              <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#111827;">Hi ${recipientName}!</h1>
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">
                <strong>${hostName}</strong> has invited you to join an interactive learning game:
                <strong>&ldquo;${gameName}&rdquo;</strong>.
              </p>
              <div style="margin:0 0 24px;padding:20px;background:#f3f4f6;border-radius:8px;text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Your invite code</p>
                <p style="margin:0;font-size:32px;font-weight:800;color:#111827;letter-spacing:.15em;">${inviteCode}</p>
              </div>
              <a href="${joinUrl}"
                style="display:block;text-align:center;background:#111827;color:#ffffff;padding:14px 24px;border-radius:8px;font-size:16px;font-weight:600;text-decoration:none;margin:0 0 24px;">
                Join game →
              </a>
              <p style="margin:0;font-size:13px;color:#9ca3af;">
                Or visit <a href="${joinUrl}" style="color:#6b7280;">${joinUrl}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
