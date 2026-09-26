/**
 * Shared HTTP response helpers. Every response goes through `hardenedHeaders`
 * so security headers are applied uniformly, matching the `reader` stance.
 */

import type { SafeShareError } from "./errors.ts";

/** Headers applied to every SafeShare response. */
export function hardenedHeaders(contentType: string): Headers {
  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  headers.set("cache-control", "no-store");
  headers.set(
    "content-security-policy",
    "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; " +
      "base-uri 'none'; form-action 'self'; frame-ancestors 'none'; " +
      "script-src 'unsafe-inline'; connect-src 'self'",
  );
  return headers;
}

/** Plain-text response with hardened headers. */
export function textResponse(message: string, status = 200): Response {
  return new Response(message, { status, headers: hardenedHeaders("text/plain; charset=utf-8") });
}

/** JSON response with hardened headers. */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: hardenedHeaders("application/json; charset=utf-8"),
  });
}

/** HTML response with hardened headers. */
export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: hardenedHeaders("text/html; charset=utf-8") });
}

/** Convert a SafeShareError (or any error) into a JSON error response. */
export function errorResponse(error: unknown): Response {
  if (error instanceof Error && "code" in error && "status" in error) {
    const typed = error as SafeShareError;
    return jsonResponse({ ok: false, code: typed.code, message: typed.message }, typed.status);
  }
  return jsonResponse({ ok: false, code: "INTERNAL", message: "Something went wrong." }, 500);
}
