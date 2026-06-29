export async function verifyTurnstileAndGetPass(
  token: string,
  scope: string
): Promise<string> {
  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!siteUrl) {
    throw new Error("Missing Convex site URL");
  }

  const response = await fetch(`${siteUrl}/verify-turnstile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, scope }),
  });

  const result = (await response.json()) as {
    success?: boolean;
    passId?: string;
    error?: string;
  };

  if (!(result.success && result.passId)) {
    throw new Error(result.error ?? "Security check failed");
  }

  return result.passId;
}
