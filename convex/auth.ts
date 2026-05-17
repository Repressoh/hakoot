import Google from "@auth/core/providers/google";
import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

const AUTH_EMAIL_FROM =
  process.env.RESEND_FROM_EMAIL ?? "Hakoot <onboarding@resend.dev>";

const magicLinkEmail = Email({
  id: "email",
  name: "Email",
  from: AUTH_EMAIL_FROM,
  maxAge: 60 * 30,
  authorize: undefined,
  async sendVerificationRequest({ identifier, url }) {
    await sendAuthEmail({
      to: identifier,
      subject: "Sign in to Hakoot",
      title: "Sign in to Hakoot",
      body: "Use this secure link to sign in to your Hakoot host account.",
      buttonLabel: "Sign in",
      url,
    });
  },
});

const passwordResetEmail = Email({
  id: "password-reset",
  name: "Password reset",
  from: AUTH_EMAIL_FROM,
  maxAge: 60 * 30,
  async sendVerificationRequest({ identifier, token, url }) {
    const resetUrl = new URL(url);
    resetUrl.searchParams.delete("code");
    resetUrl.searchParams.set("resetCode", token);

    await sendAuthEmail({
      to: identifier,
      subject: "Reset your Hakoot password",
      title: "Reset your password",
      body: "Use this secure link to choose a new password for your Hakoot account.",
      buttonLabel: "Reset password",
      url: resetUrl.toString(),
    });
  },
});

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      reset: passwordResetEmail,
    }),
    magicLinkEmail,
    Google,
  ],
  callbacks: {
    /**
     * When a user signs in with Google and the same email already exists
     * as a password-based account, link the Google account to the existing
     * user instead of creating a duplicate. This lets users sign in with
     * either email+password OR Google afterwards.
     */
    async createOrUpdateUser(ctx, args) {
      console.log(
        "[createOrUpdateUser] type:",
        args.type,
        "existingUserId:",
        args.existingUserId,
        "email:",
        args.profile?.email
      );
      try {
        if (args.existingUserId) {
          // Existing account for this provider — just return as-is
          console.log(
            "[createOrUpdateUser] existing user ID found for provider:",
            args.existingUserId
          );
          return args.existingUserId;
        }

        // For OAuth providers with a verified email, check if there's already
        // an account registered with the same email via another provider.
        if (args.profile.email && shouldLinkExistingEmail(args)) {
          const existing = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("email"), args.profile.email))
            .first();
          if (existing) {
            // Merge: return the existing user ID so the new OAuth account
            // gets linked to the same user record.
            console.log(
              "[createOrUpdateUser] merging with existing user:",
              existing._id
            );
            return existing._id;
          }
        }

        // Default: create a new user
        const newId = await ctx.db.insert("users", {
          email: args.profile.email as string | undefined,
          name: args.profile.name as string | undefined,
          image: args.profile.image as string | undefined,
          emailVerificationTime: isVerifiedEmailFlow(args)
            ? Date.now()
            : undefined,
        });
        console.log("[createOrUpdateUser] created new user:", newId);
        return newId;
      } catch (err) {
        console.error("[createOrUpdateUser] error:", err);
        throw err;
      }
    },
  },
});

function shouldLinkExistingEmail(args: {
  type: "oauth" | "credentials" | "email" | "phone" | "verification";
  profile: { email?: string; emailVerified?: boolean };
}) {
  return (
    (args.type === "oauth" && args.profile.emailVerified) ||
    args.type === "email" ||
    args.type === "verification"
  );
}

function isVerifiedEmailFlow(args: {
  type: "oauth" | "credentials" | "email" | "phone" | "verification";
  profile: { email?: string; emailVerified?: boolean };
}) {
  return Boolean(args.profile.email) && shouldLinkExistingEmail(args);
}

async function sendAuthEmail({
  to,
  subject,
  title,
  body,
  buttonLabel,
  url,
}: {
  to: string;
  subject: string;
  title: string;
  body: string;
  buttonLabel: string;
  url: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: AUTH_EMAIL_FROM,
      to,
      subject,
      html: buildAuthEmailHtml({ title, body, buttonLabel, url }),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send auth email: ${response.status}`);
  }
}

function buildAuthEmailHtml({
  title,
  body,
  buttonLabel,
  url,
}: {
  title: string;
  body: string;
  buttonLabel: string;
  url: string;
}) {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const safeButtonLabel = escapeHtml(buttonLabel);
  const safeUrl = escapeHtml(url);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Hakoot account</p>
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;">${safeTitle}</h1>
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">${safeBody}</p>
              <a href="${safeUrl}" style="display:block;text-align:center;background:#111827;color:#ffffff;padding:14px 24px;border-radius:8px;font-size:16px;font-weight:600;text-decoration:none;">${safeButtonLabel}</a>
              <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
