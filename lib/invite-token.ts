/** HMAC-based invite token for email join links */

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.INVITE_HMAC_SECRET ?? "";
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
  const key = await getKey();
  const data = new TextEncoder().encode(`${sessionId}:${name}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return Buffer.from(sig).toString("base64url");
}

export async function verifyInviteToken(
  sessionId: string,
  name: string,
  token: string
): Promise<boolean> {
  try {
    const key = await getKey();
    const data = new TextEncoder().encode(`${sessionId}:${name}`);
    const sigBytes = Buffer.from(token, "base64url");
    return crypto.subtle.verify("HMAC", key, sigBytes, data);
  } catch {
    return false;
  }
}
