import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/verify-turnstile",
  method: "POST",
  handler: httpAction(async (_ctx, req) => {
    const origin = req.headers.get("origin");
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://dev.hakoot.albertocaserta.it",
      "https://hakoot.albertocaserta.it",
    ];

    const body = await req.json();
    const { token, remoteip } = body;

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin":
              origin && allowedOrigins.includes(origin) ? origin : "",
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type",
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
            "Access-Control-Allow-Origin":
              origin && allowedOrigins.includes(origin) ? origin : "",
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type",
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
          "Access-Control-Allow-Origin":
            origin && allowedOrigins.includes(origin) ? origin : "",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
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
            "Access-Control-Allow-Origin":
              origin && allowedOrigins.includes(origin) ? origin : "",
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }
  }),
});

http.route({
  path: "/verify-turnstile",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "https://hakoot.albertocaserta.it",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

export default http;
