/** Verify a Turnstile token against the Convex `/verify-turnstile` endpoint. */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/verify-turnstile`,
    {
      body: JSON.stringify({ token }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );

  if (!response.ok) {
    return false;
  }

  const result: { success?: boolean } = await response.json();
  return result.success === true;
}
