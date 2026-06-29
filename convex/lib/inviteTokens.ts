async function getInviteKey(): Promise<CryptoKey> {
  const secret = process.env.INVITE_HMAC_SECRET ?? "";
  if (!secret) {
    throw new Error("INVITE_HMAC_SECRET is not configured");
  }
  const keyMaterial = new TextEncoder().encode(secret);
  return await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signInviteToken(
  sessionId: string,
  name: string
): Promise<string> {
  const key = await getInviteKey();
  const data = new TextEncoder().encode(`${sessionId}:${name}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return Buffer.from(sig).toString("base64url");
}

export async function verifyInviteToken(
  sessionId: string,
  name: string,
  token: string
): Promise<boolean> {
  if (!token) {
    return false;
  }
  try {
    const key = await getInviteKey();
    const data = new TextEncoder().encode(`${sessionId}:${name}`);
    const signature = Buffer.from(token, "base64url");
    return await crypto.subtle.verify("HMAC", key, signature, data);
  } catch {
    return false;
  }
}
