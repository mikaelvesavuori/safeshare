/**
 * Base64 and base64url encode/decode helpers for binary <-> string conversion.
 * Workers provides `btoa`/`atob` over latin-1 strings; these wrap the byte handling.
 */

/** Encode a Uint8Array to a standard base64 string. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Decode a standard base64 string into a Uint8Array. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encode a Uint8Array to a URL-safe base64 string (no padding). */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a URL-safe base64 string (with or without padding) into a Uint8Array. */
export function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return base64ToBytes(padded);
}

/** Encode a UTF-8 string to base64url. */
export function stringToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

/** Decode a base64url string to a UTF-8 string. */
export function base64UrlToString(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

/** Encode a Uint8Array to a lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
