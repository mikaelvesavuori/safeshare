import { reset } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import {
  generateShareId,
  getShare,
  hasDownloadsRemaining,
  incrementDownloadCount,
  isExpired,
  putShare,
  r2KeyFor,
  type ShareRecord,
  shareKeyFor,
} from "../src/kv.ts";

afterEach(async () => {
  await reset();
});

function makeRecord(overrides: Partial<ShareRecord> = {}): ShareRecord {
  return {
    id: "test-id",
    r2Key: r2KeyFor("test-id"),
    sizeBytes: 1024,
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

describe("generateShareId", () => {
  it("produces a non-empty hex string", () => {
    const id = generateShareId();
    expect(id).toBeTruthy();
    expect(id).toMatch(/^[0-9a-f]+$/);
  });

  it("produces 8-character ids", () => {
    const id = generateShareId();
    expect(id).toHaveLength(8);
  });

  it("produces unique ids", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateShareId());
    expect(ids.size).toBe(100);
  });
});

describe("key helpers", () => {
  it("r2KeyFor prefixes with share:", () => {
    expect(r2KeyFor("abc")).toBe("share:abc");
  });

  it("shareKeyFor prefixes with share:", () => {
    expect(shareKeyFor("abc")).toBe("share:abc");
  });
});

describe("putShare and getShare", () => {
  it("round-trips a share record through KV", async () => {
    const record = makeRecord();
    await putShare(env.SHARES, record, 3600);

    const fetched = await getShare(env.SHARES, "test-id");
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe("test-id");
    expect(fetched?.maxDownloads).toBe(1);
  });

  it("returns null for a missing share", async () => {
    const fetched = await getShare(env.SHARES, "nonexistent");
    expect(fetched).toBeNull();
  });

  it("returns null for unparseable JSON", async () => {
    await env.SHARES.put(shareKeyFor("broken"), "{not json");
    const fetched = await getShare(env.SHARES, "broken");
    expect(fetched).toBeNull();
  });
});

describe("incrementDownloadCount", () => {
  it("increments and persists the count", async () => {
    const record = makeRecord({ downloadCount: 0 });
    await putShare(env.SHARES, record, 3600);

    const updated = await incrementDownloadCount(env.SHARES, record, 3600);
    expect(updated.downloadCount).toBe(1);

    const fetched = await getShare(env.SHARES, "test-id");
    expect(fetched?.downloadCount).toBe(1);
  });
});

describe("isExpired", () => {
  it("returns false for a future expiry", () => {
    const record = makeRecord({ expiresAt: new Date(Date.now() + 1000).toISOString() });
    expect(isExpired(record)).toBe(false);
  });

  it("returns true for a past expiry", () => {
    const record = makeRecord({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(isExpired(record)).toBe(true);
  });

  it("returns false for null expiry (never)", () => {
    const record = makeRecord({ expiresAt: null });
    expect(isExpired(record)).toBe(false);
  });
});

describe("hasDownloadsRemaining", () => {
  it("returns true when count < max", () => {
    expect(hasDownloadsRemaining(makeRecord({ downloadCount: 0, maxDownloads: 1 }))).toBe(true);
  });

  it("returns false when count >= max", () => {
    expect(hasDownloadsRemaining(makeRecord({ downloadCount: 1, maxDownloads: 1 }))).toBe(false);
  });
});
