export async function verifyTurnstileToken(
  token: string | undefined
): Promise<void> {
  if (!token) {
    throw new Error("Turnstile verification required");
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Server configuration error");
  }

  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);

  const result = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
    }
  );

  const outcome = (await result.json()) as { success?: boolean };
  if (!outcome.success) {
    throw new Error("Turnstile verification failed");
  }
}
