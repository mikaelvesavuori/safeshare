/**
 * Share page and password verification.
 *
 * GET  /:id        — SSR share page (metadata is decrypted client-side).
 * POST /:id/verify — verify a password and return a short-lived download token.
 */

import type { Context } from "hono";
import { createDownloadToken, verifyPassword } from "../crypto.ts";
import type { Env } from "../env.ts";
import { DOWNLOAD_TOKEN_TTL_SECONDS } from "../env.ts";
import { badRequest, expired, notFound, passwordInvalid, passwordRequired } from "../errors.ts";
import { errorResponse, htmlResponse, jsonResponse } from "../http.ts";
import { getShare, isExpired } from "../kv.ts";
import { renderExpiredPage, renderSharePage } from "../render.ts";

type AppContext = Context<{ Bindings: Env }>;

/** GET /:id — render the share page, or the expired/not-found page. */
export async function sharePage(c: AppContext): Promise<Response> {
  const id = c.req.param("id");
  if (id === undefined) return errorResponse(notFound());
  const record = await getShare(c.env.SHARES, id);

  if (record === null) return htmlResponse(renderExpiredPage(), 404);

  const alive = !isExpired(record) && record.downloadCount < record.maxDownloads;
  if (!alive) return htmlResponse(renderExpiredPage(), 410);

  return htmlResponse(renderSharePage(record));
}

/** POST /:id/verify — check a password and issue a download capability token. */
export async function verifySharePassword(c: AppContext): Promise<Response> {
  const id = c.req.param("id");
  if (id === undefined) return errorResponse(notFound());
  const record = await getShare(c.env.SHARES, id);

  if (record === null) return errorResponse(notFound());
  if (isExpired(record)) return errorResponse(expired());
  if (record.downloadCount >= record.maxDownloads) return errorResponse(expired());

  if (record.passwordHash === null || record.passwordSalt === null) {
    return errorResponse(badRequest("This share has no password."));
  }

  let payload: { password?: unknown };
  try {
    payload = (await c.req.json()) as { password?: unknown };
  } catch {
    return errorResponse(badRequest("Expected a JSON body with a password."));
  }

  const password = payload.password;
  if (typeof password !== "string" || password.length === 0) {
    return errorResponse(passwordRequired());
  }

  const ok = await verifyPassword(password, record.passwordHash, record.passwordSalt);
  if (!ok) return errorResponse(passwordInvalid());

  const { token, exp } = await createDownloadToken(
    id,
    c.env.TOKEN_SECRET,
    DOWNLOAD_TOKEN_TTL_SECONDS,
  );
  return jsonResponse({
    ok: true,
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
  });
}
