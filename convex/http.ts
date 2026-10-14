import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  "https://dev.hakoot.albertocaserta.it",
  "https://hakoot-dev.albertocaserta.it",
  "https://hakoot.albertocaserta.it",
]);

/** CORS headers for /verify-turnstile. Shared by the preflight and the POST so
 * the browser gets the same answer to both. */
function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(
  origin: string | null,
  body: unknown,
  status: number
): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    status,
  });
}

/** Parse the request body as JSON, returning its fields (empty if it isn't a JSON object). */
async function readJsonFields(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

http.route({
  handler: httpAction(async (_ctx, req) => {
    const origin = req.headers.get("origin");

    const fields = await readJsonFields(req);
    const token = typeof fields.token === "string" ? fields.token : "";
    const remoteip =
      typeof fields.remoteip === "string" ? fields.remoteip : undefined;

    if (!token) {
      return jsonResponse(
        origin,
        { error: "Token is required", success: false },
        400
      );
    }

    const formData = new FormData();
    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
      return jsonResponse(
        origin,
        { error: "Server configuration error", success: false },
        500
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
          body: formData,
          method: "POST",
        }
      );

      if (!result.ok) {
        throw new Error(`Turnstile siteverify failed: ${result.status}`);
      }

      const outcome = await result.json();

      return jsonResponse(origin, outcome, 200);
    } catch {
      return jsonResponse(
        origin,
        { error: "Verification failed", success: false },
        500
      );
    }
  }),
  method: "POST",
  path: "/verify-turnstile",
});

http.route({
  handler: httpAction(
    async (_ctx, req) =>
      new Response(null, {
        headers: {
          ...corsHeaders(req.headers.get("origin")),
          "Access-Control-Max-Age": "86400",
        },
        status: 204,
      })
  ),
  method: "OPTIONS",
  path: "/verify-turnstile",
});

export default http;
