/**
 * Workers KV access for share metadata.
 *
 * Each share is a single JSON record under `share:<id>`. KV entries carry an
 * `expirationTtl` matching the share's expiry so metadata self-destructs;
 * R2 ciphertext blobs are deleted on download (one-time) or swept by an
 * optional R2 lifecycle rule.
 */

import { bytesToHex } from "./encoding.ts";
import { R2_KEY_PREFIX, SHARE_ID_BYTES, SHARE_KEY_PREFIX } from "./env.ts";

/** Stored metadata for a share. Ciphertext and IVs are opaque to the server. */
export interface ShareRecord {
  id: string;
  /** R2 object key holding the file ciphertext. */
  r2Key: string;
  /** Original plaintext size in bytes (display only). */
  sizeBytes: number;
  /** Encrypted metadata (filename + content type), base64. */
  metaCipher: string;
  /** IV for the encrypted metadata, base64. */
  metaIv: string;
  /** IV for the file ciphertext (in R2), base64. Needed to decrypt on download. */
  fileIv: string;
  /** PBKDF2 hash of the optional password, base64. Null if no password. */
  passwordHash: string | null;
  /** PBKDF2 salt, base64. Null if no password. */
  passwordSalt: string | null;
  /** Maximum number of downloads allowed. */
  maxDownloads: number;
  /** Downloads consumed so far. */
  downloadCount: number;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of expiry, or null for never. */
  expiresAt: string | null;
  /** Stored decryption key (base64url) for short-URL shares. Null for E2E shares (key lives in URL fragment). */
  key: string | null;
}

/** Generate a fresh unguessable share id (32 bits, 8 lowercase hex chars). */
export function generateShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_ID_BYTES));
  return bytesToHex(bytes);
}

/** R2 object key for a share id. */
export function r2KeyFor(id: string): string {
  return `${R2_KEY_PREFIX}${id}`;
}

/** KV key for a share id. */
export function shareKeyFor(id: string): string {
  return `${SHARE_KEY_PREFIX}${id}`;
}

/** Read a share record. Returns null when missing or unparseable. */
export async function getShare(kv: KVNamespace, id: string): Promise<ShareRecord | null> {
  const raw = await kv.get(shareKeyFor(id));
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as ShareRecord;
  } catch {
    return null;
  }
}

/**
 * Write a share record. If `expiresAtSeconds` is a positive number it is used as
 * the KV `expirationTtl` (clamped to the 60s minimum); otherwise the entry persists.
 */
export async function putShare(
  kv: KVNamespace,
  record: ShareRecord,
  expiresAtSeconds: number | null,
): Promise<void> {
  const options: KVNamespacePutOptions = {};
  if (expiresAtSeconds !== null && expiresAtSeconds > 0) {
    options.expirationTtl = Math.max(60, expiresAtSeconds);
  }
  await kv.put(shareKeyFor(record.id), JSON.stringify(record), options);
}

/**
 * Increment the download counter and persist the updated record.
 * Returns the new record. This is NOT atomic across concurrent requests; see
 * the AGENTS.md "Known limitations" note.
 */
export async function incrementDownloadCount(
  kv: KVNamespace,
  record: ShareRecord,
  expiresAtSeconds: number | null,
): Promise<ShareRecord> {
  const updated: ShareRecord = { ...record, downloadCount: record.downloadCount + 1 };
  await putShare(kv, updated, expiresAtSeconds);
  return updated;
}

/** Remaining TTL in seconds for a record, or null if it never expires. */
export function remainingTtlSeconds(record: ShareRecord): number | null {
  if (record.expiresAt === null) return null;
  const remaining = Math.floor((Date.parse(record.expiresAt) - Date.now()) / 1000);
  return remaining;
}

/** Whether a record has passed its expiry timestamp. */
export function isExpired(record: ShareRecord): boolean {
  if (record.expiresAt === null) return false;
  return Date.parse(record.expiresAt) <= Date.now();
}

/** Whether a record has downloads remaining. */
export function hasDownloadsRemaining(record: ShareRecord): boolean {
  return record.downloadCount < record.maxDownloads;
}
