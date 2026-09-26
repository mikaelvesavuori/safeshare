import { reset } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import { verifyDownloadToken } from "../src/crypto.ts";
import { getShare } from "../src/kv.ts";

afterEach(async () => {
  await reset();
});

function fetchWorker(path: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(`http://safeshare.test${path}`, init) as Promise<Response>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return base64ToBytes(padded);
}

async function encryptShare(
  fileName: string,
  contentType: string,
  plaintext: Uint8Array,
): Promise<{
  formData: FormData;
  keyStr: string;
}> {
  const key = (await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ])) as CryptoKey;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  const metaIv = crypto.getRandomValues(new Uint8Array(12));
  const meta = JSON.stringify({ name: fileName, type: contentType });
  const metaBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: metaIv },
    key,
    new TextEncoder().encode(meta),
  );

  const rawKey = (await crypto.subtle.exportKey("raw", key)) as ArrayBuffer;
  const keyStr = bytesToBase64Url(new Uint8Array(rawKey));

  const fd = new FormData();
  fd.append("file", new Blob([cipherBuf]));
  fd.append("iv", bytesToBase64(iv));
  fd.append("meta", new Blob([metaBuf]));
  fd.append("metaIv", bytesToBase64(metaIv));
  fd.append("size", String(plaintext.length));

  return { formData: fd, keyStr };
}

async function decryptMeta(
  metaCipherB64: string,
  metaIvB64: string,
  keyStr: string,
): Promise<{ name: string; type: string }> {
  const key = await crypto.subtle.importKey(
    "raw",
    base64UrlToBytes(keyStr),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(metaIvB64) },
    key,
    base64ToBytes(metaCipherB64),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as { name: string; type: string };
}

async function decryptFile(
  cipherBuf: ArrayBuffer,
  fileIvB64: string,
  keyStr: string,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    base64UrlToBytes(keyStr),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(fileIvB64) },
    key,
    cipherBuf,
  );
  return new Uint8Array(plain);
}

async function getMetaFromSharePage(id: string): Promise<{
  metaCipher: string;
  metaIv: string;
  fileIv: string;
}> {
  const res = await fetchWorker(`/${id}`);
  const html = await res.text();
  const get = (attr: string): string => {
    const match = html.match(new RegExp(`data-${attr}="([^"]+)"`));
    if (!match?.[1]) throw new Error(`Attribute ${attr} not found in share page`);
    return match[1];
  };
  return {
    metaCipher: get("meta-cipher"),
    metaIv: get("meta-iv"),
    fileIv: get("file-iv"),
  };
}

describe("E2E: upload and download without password", () => {
  it("encrypts, uploads, downloads, and decrypts a file", async () => {
    const plaintext = new TextEncoder().encode("Hello, SafeShare!");
    const { formData, keyStr } = await encryptShare("hello.txt", "text/plain", plaintext);

    const uploadRes = await fetchWorker("/api/upload", { method: "POST", body: formData });
    expect(uploadRes.status).toBe(200);
    const uploadData = (await uploadRes.json()) as { ok: boolean; id: string; url: string };
    expect(uploadData.ok).toBe(true);
    expect(uploadData.id).toBeTruthy();
    expect(uploadData.url).toContain(uploadData.id);

    const id = uploadData.id;

    const record = await getShare(env.SHARES, id);
    expect(record).not.toBeNull();
    expect(record?.maxDownloads).toBe(1);
    expect(record?.downloadCount).toBe(0);
    expect(record?.passwordHash).toBeNull();

    const { metaCipher, metaIv, fileIv } = await getMetaFromSharePage(id);
    const meta = await decryptMeta(metaCipher, metaIv, keyStr);
    expect(meta.name).toBe("hello.txt");
    expect(meta.type).toBe("text/plain");

    const dlRes = await fetchWorker(`/${id}/download`);
    expect(dlRes.status).toBe(200);
    const cipherBuf = await dlRes.arrayBuffer();
    const decrypted = await decryptFile(cipherBuf, fileIv, keyStr);
    expect(new TextDecoder().decode(decrypted)).toBe("Hello, SafeShare!");

    const updated = await getShare(env.SHARES, id);
    expect(updated?.downloadCount).toBe(1);
  });

  it("blocks a second download on a one-time share", async () => {
    const plaintext = new TextEncoder().encode("one-time only");
    const { formData } = await encryptShare("secret.txt", "text/plain", plaintext);

    const uploadRes = await fetchWorker("/api/upload", { method: "POST", body: formData });
    const uploadData = (await uploadRes.json()) as { id: string };
    const id = uploadData.id;

    const first = await fetchWorker(`/${id}/download`);
    expect(first.status).toBe(200);

    const second = await fetchWorker(`/${id}/download`);
    expect(second.status).toBe(410);
  });
});

describe("E2E: upload and download with password", () => {
  it("requires a token for password-protected downloads", async () => {
    const plaintext = new TextEncoder().encode("password protected");
    const { formData, keyStr } = await encryptShare("secret.txt", "text/plain", plaintext);
    formData.append("password", "s3cret");

    const uploadRes = await fetchWorker("/api/upload", { method: "POST", body: formData });
    expect(uploadRes.status).toBe(200);
    const uploadData = (await uploadRes.json()) as { id: string };
    const id = uploadData.id;

    const record = await getShare(env.SHARES, id);
    expect(record?.passwordHash).not.toBeNull();

    const { fileIv } = await getMetaFromSharePage(id);

    const dlNoToken = await fetchWorker(`/${id}/download`);
    expect(dlNoToken.status).toBe(401);

    const verifyRes = await fetchWorker(`/${id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "s3cret" }),
    });
    expect(verifyRes.status).toBe(200);
    const verifyData = (await verifyRes.json()) as { token: string };
    expect(verifyData.token).toBeTruthy();

    const tokenValid = await verifyDownloadToken(verifyData.token, id, env.TOKEN_SECRET);
    expect(tokenValid).toBe(true);

    const dlRes = await fetchWorker(`/${id}/download?token=${verifyData.token}`);
    expect(dlRes.status).toBe(200);
    const cipherBuf = await dlRes.arrayBuffer();

    const decrypted = await decryptFile(cipherBuf, fileIv, keyStr);
    expect(new TextDecoder().decode(decrypted)).toBe("password protected");
  });

  it("rejects download with wrong password token", async () => {
    const plaintext = new TextEncoder().encode("nope");
    const { formData } = await encryptShare("nope.txt", "text/plain", plaintext);
    formData.append("password", "correct");

    const uploadRes = await fetchWorker("/api/upload", { method: "POST", body: formData });
    const uploadData = (await uploadRes.json()) as { id: string };
    const id = uploadData.id;

    const verifyRes = await fetchWorker(`/${id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    expect(verifyRes.status).toBe(401);
  });
});

describe("E2E: upload validation", () => {
  it("rejects an upload missing the file", async () => {
    const fd = new FormData();
    const res = await fetchWorker("/api/upload", { method: "POST", body: fd });
    expect(res.status).toBe(400);
  });

  it("rejects an upload with an invalid IV length", async () => {
    const plaintext = new TextEncoder().encode("test");
    const { formData } = await encryptShare("test.txt", "text/plain", plaintext);
    formData.append("iv", "short");

    const res = await fetchWorker("/api/upload", { method: "POST", body: formData });
    expect(res.status).toBe(400);
  });

  it("accepts custom maxDownloads and expiresIn", async () => {
    const plaintext = new TextEncoder().encode("multi-download");
    const { formData } = await encryptShare("multi.txt", "text/plain", plaintext);
    formData.append("maxDownloads", "3");
    formData.append("expiresIn", "3600");

    const res = await fetchWorker("/api/upload", { method: "POST", body: formData });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { id: string };
    const record = await getShare(env.SHARES, data.id);
    expect(record?.maxDownloads).toBe(3);
  });
});
