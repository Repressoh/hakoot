import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://dev.hakoot.albertocaserta.it",
  "https://hakoot.albertocaserta.it",
];

const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
};

http.route({
  path: "/verify-turnstile",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, req) => {
    const origin = req.headers.get("origin");
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }),
});

http.route({
  path: "/verify-turnstile",
  method: "POST",
  handler: httpAction(async (_ctx, req) => {
    const origin = req.headers.get("origin");
    const corsHeaders = getCorsHeaders(origin);

    const body = await req.json();
    const { token, remoteip } = body;

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const formData = new FormData();
    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteip) {
      formData.append("remoteip", remoteip);
    }

    try {
      const result = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          body: formData,
        }
      );

      const outcome = await result.json();

      return new Response(JSON.stringify(outcome), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Verification failed",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  }),
});

export default http;
