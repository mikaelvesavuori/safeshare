/**
 * POST /api/upload — receive encrypted ciphertext, store in R2 + KV, return the share URL.
 *
 * The server never sees the plaintext file or its key; it only validates and
 * stores opaque ciphertext and IVs alongside display-only metadata.
 */

import type { Context } from "hono";
import { hashPassword } from "../crypto.ts";
import { base64ToBytes, bytesToBase64 } from "../encoding.ts";
import type { Env } from "../env.ts";
import {
  ALLOWED_EXPIRES_IN_SECONDS,
  DEFAULT_EXPIRES_IN_SECONDS,
  DEFAULT_MAX_DOWNLOADS,
  MAX_ENCRYPTED_BYTES,
  MAX_MAX_DOWNLOADS,
} from "../env.ts";
import { badRequest, isSafeShareError, unauthorized, uploadTooLarge } from "../errors.ts";
import { errorResponse, jsonResponse } from "../http.ts";
import { generateShareId, putShare, r2KeyFor, type ShareRecord } from "../kv.ts";

const META_CIPHER_MAX_BYTES = 8192;
const PASSWORD_MAX_LENGTH = 1000;
const KEY_MAX_LENGTH = 64;

type AppContext = Context<{ Bindings: Env }>;

interface ParsedUpload {
  file: File;
  fileIv: string;
  meta: File;
  metaIv: string;
  sizeBytes: number;
  password: string | null;
  maxDownloads: number;
  expiresIn: number;
  key: string | null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFile(value: unknown): value is File {
  return value instanceof File;
}

function parseInteger(raw: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

/** Validate and normalize the multipart upload payload. */
function parseUpload(fields: Record<string, unknown>): ParsedUpload {
  const file = fields.file;
  if (!isFile(file)) throw badRequest("Missing encrypted file payload.");

  if (file.size > MAX_ENCRYPTED_BYTES) throw uploadTooLarge(MAX_ENCRYPTED_BYTES);
  if (file.size === 0) throw badRequest("Encrypted file payload is empty.");

  const fileIvRaw = fields.iv;
  if (!isString(fileIvRaw)) throw badRequest("Missing file IV.");
  const fileIvBytes = base64ToBytes(fileIvRaw);
  if (fileIvBytes.byteLength !== 12) throw badRequest("File IV must be 12 bytes.");

  const meta = fields.meta;
  if (!isFile(meta)) throw badRequest("Missing encrypted metadata.");
  if (meta.size > META_CIPHER_MAX_BYTES) throw badRequest("Encrypted metadata is too large.");

  const metaIvRaw = fields.metaIv;
  if (!isString(metaIvRaw)) throw badRequest("Missing metadata IV.");
  const metaIvBytes = base64ToBytes(metaIvRaw);
  if (metaIvBytes.byteLength !== 12) throw badRequest("Metadata IV must be 12 bytes.");

  const sizeRaw = fields.size;
  if (!isString(sizeRaw)) throw badRequest("Missing plaintext size.");
  const sizeBytes = Number.parseInt(sizeRaw, 10);
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0 || sizeBytes > MAX_ENCRYPTED_BYTES) {
    throw badRequest("Invalid plaintext size.");
  }

  const passwordRaw = fields.password;
  const password = isString(passwordRaw) && passwordRaw.length > 0 ? passwordRaw : null;
  if (password !== null && password.length > PASSWORD_MAX_LENGTH)
    throw badRequest("Password is too long.");

  const maxDownloadsRaw = isString(fields.maxDownloads) ? fields.maxDownloads : "";
  const maxDownloads = parseInteger(maxDownloadsRaw, DEFAULT_MAX_DOWNLOADS, 1, MAX_MAX_DOWNLOADS);

  const expiresInRaw = isString(fields.expiresIn) ? fields.expiresIn : "";
  const expiresInParsed = Number.parseInt(expiresInRaw, 10);
  const expiresIn =
    Number.isFinite(expiresInParsed) && ALLOWED_EXPIRES_IN_SECONDS.has(expiresInParsed)
      ? expiresInParsed
      : DEFAULT_EXPIRES_IN_SECONDS;

  const keyRaw = fields.key;
  const key =
    isString(keyRaw) && keyRaw.length > 0 && keyRaw.length <= KEY_MAX_LENGTH ? keyRaw : null;

  return {
    file,
    fileIv: fileIvRaw,
    meta,
    metaIv: metaIvRaw,
    sizeBytes,
    password,
    maxDownloads,
    expiresIn,
    key,
  };
}

export async function uploadFile(c: AppContext): Promise<Response> {
  const env = c.env;

  if (env.UPLOAD_TOKEN !== undefined && env.UPLOAD_TOKEN.length > 0) {
    const sent = c.req.header("x-upload-token");
    if (sent !== env.UPLOAD_TOKEN) return errorResponse(unauthorized());
  }

  let parsed: ParsedUpload;
  try {
    const body = await c.req.parseBody();
    parsed = parseUpload(body as Record<string, unknown>);
  } catch (error) {
    if (isSafeShareError(error)) return errorResponse(error);
    return errorResponse(badRequest("Malformed upload request."));
  }

  const metaCipher = bytesToBase64(new Uint8Array(await parsed.meta.arrayBuffer()));
  const id = generateShareId();
  const r2Key = r2KeyFor(id);

  let passwordHash: string | null = null;
  let passwordSalt: string | null = null;
  if (parsed.password !== null) {
    const hashed = await hashPassword(parsed.password);
    passwordHash = hashed.hash;
    passwordSalt = hashed.salt;
  }

  const now = Date.now();
  const expiresAt =
    parsed.expiresIn === 0 ? null : new Date(now + parsed.expiresIn * 1000).toISOString();
  const ttlSeconds = parsed.expiresIn === 0 ? null : parsed.expiresIn;

  try {
    await env.BUCKET.put(r2Key, parsed.file.stream(), {
      httpMetadata: { contentType: "application/octet-stream" },
    });
  } catch {
    return errorResponse(badRequest("Failed to store the encrypted file."));
  }

  const record: ShareRecord = {
    id,
    r2Key,
    sizeBytes: parsed.sizeBytes,
    metaCipher,
    metaIv: parsed.metaIv,
    fileIv: parsed.fileIv,
    passwordHash,
    passwordSalt,
    maxDownloads: parsed.maxDownloads,
    downloadCount: 0,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    key: parsed.key,
  };

  try {
    await putShare(env.SHARES, record, ttlSeconds);
  } catch {
    c.executionCtx.waitUntil(env.BUCKET.delete(r2Key));
    return errorResponse(badRequest("Failed to store share metadata."));
  }

  const origin = new URL(c.req.url).origin;
  return jsonResponse({ ok: true, id, url: `${origin}/${id}`, shortUrl: parsed.key !== null });
}
