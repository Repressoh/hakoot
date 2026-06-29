import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { verifyTurnstileToken } from "./lib/turnstile";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/verify-turnstile",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const origin = req.headers.get("origin");
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://dev.hakoot.albertocaserta.it",
      "https://hakoot.albertocaserta.it",
    ];

    const body = await req.json();
    const { token, scope } = body;

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

    try {
      await verifyTurnstileToken(token);

      let passId: string | undefined;
      if (typeof scope === "string" && scope.length > 0) {
        passId = crypto.randomUUID();
        await ctx.runMutation(internal.turnstilePasses.createPass, {
          passId,
          scope,
        });
      }

      return new Response(
        JSON.stringify({ success: true, ...(passId ? { passId } : {}) }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin":
              origin && allowedOrigins.includes(origin) ? origin : "",
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
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
  handler: httpAction(
    async () =>
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "https://hakoot.albertocaserta.it",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      })
  ),
});

export default http;
