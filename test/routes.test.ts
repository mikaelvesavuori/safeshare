import { reset } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "../src/crypto.ts";
import { putShare, type ShareRecord } from "../src/kv.ts";

afterEach(async () => {
  await reset();
});

function fetchWorker(path: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(`http://safeshare.test${path}`, init) as Promise<Response>;
}

function makeRecord(overrides: Partial<ShareRecord> = {}): ShareRecord {
  return {
    id: "test-id",
    r2Key: "share:test-id",
    sizeBytes: 42,
    metaCipher: "dGVzdA",
    metaIv: "dGVzdA==",
    fileIv: "dGVzdA==",
    passwordHash: null,
    passwordSalt: null,
    maxDownloads: 1,
    downloadCount: 0,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    key: null,
    ...overrides,
  };
}

describe("GET /", () => {
  it("returns the landing page HTML", async () => {
    const res = await fetchWorker("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("SafeShare");
    expect(html).toContain("Share");
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("sets hardened security headers", async () => {
    const res = await fetchWorker("/");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
  });
});

describe("GET /:id (share page)", () => {
  it("returns the share page for an alive share", async () => {
    await putShare(env.SHARES, makeRecord(), 3600);
    const res = await fetchWorker("/test-id");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-share-id="test-id"');
  });

  it("returns 404 for a missing share", async () => {
    const res = await fetchWorker("/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 410 for an expired share", async () => {
    const record = makeRecord({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    await putShare(env.SHARES, record, null);
    const res = await fetchWorker("/test-id");
    expect(res.status).toBe(410);
  });

  it("returns 410 for a share with exhausted downloads", async () => {
    const record = makeRecord({ downloadCount: 1, maxDownloads: 1 });
    await putShare(env.SHARES, record, 3600);
    const res = await fetchWorker("/test-id");
    expect(res.status).toBe(410);
  });
});

describe("POST /:id/verify (password)", () => {
  it("returns badRequest for a share with no password", async () => {
    await putShare(env.SHARES, makeRecord(), 3600);
    const res = await fetchWorker("/test-id/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "anything" }),
    });
    expect(res.status).toBe(400);
  });

  it("accepts the correct password and returns a token", async () => {
    const { hash, salt } = await hashPassword("s3cret");
    await putShare(env.SHARES, makeRecord({ passwordHash: hash, passwordSalt: salt }), 3600);

    const res = await fetchWorker("/test-id/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "s3cret" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; token: string };
    expect(data.ok).toBe(true);
    expect(data.token).toBeTruthy();
  });

  it("rejects an incorrect password", async () => {
    const { hash, salt } = await hashPassword("s3cret");
    await putShare(env.SHARES, makeRecord({ passwordHash: hash, passwordSalt: salt }), 3600);

    const res = await fetchWorker("/test-id/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects an empty password", async () => {
    const { hash, salt } = await hashPassword("s3cret");
    await putShare(env.SHARES, makeRecord({ passwordHash: hash, passwordSalt: salt }), 3600);

    const res = await fetchWorker("/test-id/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "" }),
    });
    expect(res.status).toBe(401);
  });
});
