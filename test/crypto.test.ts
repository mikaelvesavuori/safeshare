import { reset } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  createDownloadToken,
  hashPassword,
  verifyDownloadToken,
  verifyPassword,
} from "../src/crypto.ts";

afterEach(async () => {
  await reset();
});

const SECRET = "test-secret-for-vitest-only-32-bytes-long";

describe("hashPassword and verifyPassword", () => {
  it("hashes a password and verifies it correctly", async () => {
    const { hash, salt } = await hashPassword("correct horse battery staple");
    expect(hash).toBeTruthy();
    expect(salt).toBeTruthy();
    expect(hash).not.toBe("correct horse battery staple");

    const ok = await verifyPassword("correct horse battery staple", hash, salt);
    expect(ok).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const { hash, salt } = await hashPassword("my-password");
    const ok = await verifyPassword("wrong-password", hash, salt);
    expect(ok).toBe(false);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a.hash).not.toBe(b.hash);
    expect(a.salt).not.toBe(b.salt);
  });
});

describe("createDownloadToken and verifyDownloadToken", () => {
  it("creates and verifies a valid token", async () => {
    const { token } = await createDownloadToken("share-123", SECRET, 600);
    expect(token).toBeTruthy();
    expect(token).toContain(".");

    const ok = await verifyDownloadToken(token, "share-123", SECRET);
    expect(ok).toBe(true);
  });

  it("rejects a token for a different share id", async () => {
    const { token } = await createDownloadToken("share-123", SECRET, 600);
    const ok = await verifyDownloadToken(token, "share-456", SECRET);
    expect(ok).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const { token } = await createDownloadToken("share-123", SECRET, 600);
    const ok = await verifyDownloadToken(token, "share-123", "wrong-secret");
    expect(ok).toBe(false);
  });

  it("rejects a tampered token", async () => {
    const { token } = await createDownloadToken("share-123", SECRET, 600);
    const tampered = `${token.slice(0, -2)}xx`;
    const ok = await verifyDownloadToken(tampered, "share-123", SECRET);
    expect(ok).toBe(false);
  });

  it("rejects an expired token (ttl 0)", async () => {
    const { token } = await createDownloadToken("share-123", SECRET, 0);
    const ok = await verifyDownloadToken(token, "share-123", SECRET);
    expect(ok).toBe(false);
  });

  it("rejects a malformed token", async () => {
    const ok = await verifyDownloadToken("not.a.valid.token", "share-123", SECRET);
    expect(ok).toBe(false);
  });
});

describe("constantTimeEqual", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(constantTimeEqual("abc", "abd")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(constantTimeEqual("abc", "ab")).toBe(false);
  });
});
