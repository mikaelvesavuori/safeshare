/**
 * Server-side cryptography for SafeShare.
 *
 * - PBKDF2 password hashing (server-side password gate, independent of E2E)
 * - HMAC-SHA256 download capability tokens (stateless, short-lived)
 * - Constant-time comparison helper
 *
 * End-to-end file encryption happens entirely in the browser; the server never
 * holds or processes a plaintext file or its key.
 */

import {
  base64ToBytes,
  base64UrlToBytes,
  base64UrlToString,
  bytesToBase64,
  bytesToBase64Url,
  stringToBase64Url,
} from "./encoding.ts";
import { PBKDF2_HASH_BYTES, PBKDF2_ITERATIONS, PBKDF2_SALT_BYTES } from "./env.ts";

/** Result of hashing a password for storage. */
export interface PasswordHash {
  hash: string;
  salt: string;
}

/** Hash a password with PBKDF2 (SHA-256), returning base64 hash + salt. */
export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const hash = await derivePbkdf2Bits(password, salt, PBKDF2_HASH_BYTES * 8);
  return { hash: bytesToBase64(hash), salt: bytesToBase64(salt) };
}

/** Verify a password against a stored PBKDF2 hash + salt, constant-time on the digest. */
export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
): Promise<boolean> {
  const salt = base64ToBytes(storedSalt);
  const hash = await derivePbkdf2Bits(password, salt, PBKDF2_HASH_BYTES * 8);
  return constantTimeEqual(bytesToBase64(hash), storedHash);
}

async function derivePbkdf2Bits(
  password: string,
  salt: Uint8Array,
  bits: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    bits,
  );
  return new Uint8Array(derived);
}

/** A signed download capability token plus its expiry (epoch seconds). */
export interface DownloadToken {
  token: string;
  exp: number;
}

/** Create a short-lived HMAC token authorizing a download for `id`. */
export async function createDownloadToken(
  id: string,
  secret: string,
  ttlSeconds: number,
): Promise<DownloadToken> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = stringToBase64Url(JSON.stringify({ id, exp }));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return { token: `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`, exp };
}

/** Verify a download token against `id` and `secret`. Returns true if valid and unexpired. */
export async function verifyDownloadToken(
  token: string,
  id: string,
  secret: string,
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const payload = parts[0];
  const signature = parts[1];
  if (payload === undefined || signature === undefined) return false;

  const key = await importHmacKey(secret);
  let signatureValid = false;
  try {
    signatureValid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature),
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
  if (!signatureValid) return false;

  try {
    const data = JSON.parse(base64UrlToString(payload)) as { id?: unknown; exp?: unknown };
    if (data.id !== id) return false;
    if (typeof data.exp !== "number") return false;
    return data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Constant-time string equality, suitable for comparing short base64 digests. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
