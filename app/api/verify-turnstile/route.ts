import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { token, remoteip } = await request.json();

  if (!token) {
    return NextResponse.json(
      { success: false, error: "Token is required" },
      { status: 400 }
    );
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: "Server configuration error" },
      { status: 500 }
    );
  }

  const params = new URLSearchParams();
  params.append("secret", secretKey);
  params.append("response", token);
  if (remoteip) {
    params.append("remoteip", remoteip);
  }

  try {
    const result = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: params,
      }
    );

    const outcome = await result.json();

    return NextResponse.json(outcome);
  } catch {
    return NextResponse.json(
      { success: false, error: "Verification failed" },
      { status: 500 }
    );
  }
}
