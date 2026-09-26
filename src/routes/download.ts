/**
 * GET /:id/download — stream the ciphertext from R2 after gating checks.
 *
 * Consumes one download (KV counter increment before streaming). For a
 * one-time share (maxDownloads === 1) the R2 object is deleted after the
 * stream completes. See AGENTS.md for the atomicity caveat.
 */

import type { Context } from "hono";
import { verifyDownloadToken } from "../crypto.ts";
import type { Env } from "../env.ts";
import {
  downloadLimitReached,
  expired,
  notFound,
  passwordRequired,
  tokenExpired,
} from "../errors.ts";
import { errorResponse, hardenedHeaders } from "../http.ts";
import { getShare, incrementDownloadCount, remainingTtlSeconds } from "../kv.ts";

type AppContext = Context<{ Bindings: Env }>;

export async function downloadFile(c: AppContext): Promise<Response> {
  const env = c.env;
  const id = c.req.param("id");
  if (id === undefined) return errorResponse(notFound());
  const record = await getShare(env.SHARES, id);

  if (record === null) return errorResponse(notFound());

  if (record.expiresAt !== null && Date.parse(record.expiresAt) <= Date.now()) {
    return errorResponse(expired());
  }

  if (record.downloadCount >= record.maxDownloads) {
    return errorResponse(downloadLimitReached());
  }

  if (record.passwordHash !== null) {
    const token = c.req.query("token");
    if (typeof token !== "string" || token.length === 0) return errorResponse(passwordRequired());
    const ok = await verifyDownloadToken(token, id, env.TOKEN_SECRET);
    if (!ok) return errorResponse(tokenExpired());
  }

  const updated = await incrementDownloadCount(env.SHARES, record, remainingTtlSeconds(record));

  const object = await env.BUCKET.get(record.r2Key);
  if (object === null) return errorResponse(downloadLimitReached());

  const headers = hardenedHeaders("application/octet-stream");
  headers.set("content-disposition", `attachment; filename="${id}.enc"`);
  headers.set("content-length", String(object.size));

  const body = object.body;
  const response = new Response(body, { status: 200, headers });

  if (updated.downloadCount >= record.maxDownloads) {
    c.executionCtx.waitUntil(env.BUCKET.delete(record.r2Key));
  }

  return response;
}
