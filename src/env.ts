/**
 * Environment bindings and app-wide constants for SafeShare.
 */

/** Cloudflare Worker bindings and secrets injected at runtime. */
export interface Env {
  /** Workers KV namespace holding share metadata (auto-expiring via TTL). */
  SHARES: KVNamespace;
  /** R2 bucket holding ciphertext blobs. */
  BUCKET: R2Bucket;
  /** HMAC secret used to sign short-lived download capability tokens. */
  TOKEN_SECRET: string;
  /** Optional: if set, POST /api/upload requires this value in `x-upload-token`. */
  UPLOAD_TOKEN?: string;
}

/** Maximum ciphertext size accepted on upload (100 MB). */
export const MAX_ENCRYPTED_BYTES = 100 * 1024 * 1024;

/** Default and limit values for download counts. */
export const DEFAULT_MAX_DOWNLOADS = 1;
export const MAX_MAX_DOWNLOADS = 100;

/** Default share expiry (1 day) in seconds. */
export const DEFAULT_EXPIRES_IN_SECONDS = 86_400;

/** Allowed expiry durations, in seconds. `0` means "never expire". */
export const ALLOWED_EXPIRES_IN_SECONDS = new Set<number>([
  3_600, // 1 hour
  86_400, // 1 day
  604_800, // 7 days
  0, // never
]);

/** Lifetime of a download capability token, in seconds. */
export const DOWNLOAD_TOKEN_TTL_SECONDS = 600;

/** PBKDF2 parameters for server-side password hashing. */
export const PBKDF2_ITERATIONS = 100_000;
export const PBKDF2_SALT_BYTES = 16;
export const PBKDF2_HASH_BYTES = 32;

/** Number of random bytes used to generate a share id (hex -> 8 chars). */
export const SHARE_ID_BYTES = 4;

/** KV key prefix for share records. */
export const SHARE_KEY_PREFIX = "share:";

/** R2 object key prefix for ciphertext blobs. */
export const R2_KEY_PREFIX = "share:";
