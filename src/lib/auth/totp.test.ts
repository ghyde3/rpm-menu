import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  generateTotpSecret,
  generateTotpToken,
  verifyTotpToken,
  buildOtpAuthUri,
  generateBackupCodes,
  hashBackupCode,
  consumeBackupCode,
  encryptTotpSecret,
  decryptTotpSecret,
} from "./totp";

describe("totp", () => {
  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET ?? "test-secret-for-totp-unit-tests";
  });

  it("generates a base32 secret with no padding", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThan(20);
  });

  it("round-trips a token generated at a fixed time", () => {
    const secret = generateTotpSecret();
    const at = 1_700_000_000_000; // fixed instant
    const token = generateTotpToken(secret, {}, at);
    expect(token).toMatch(/^\d{6}$/);
    expect(verifyTotpToken(secret, token, {}, 1, at)).toBe(true);
  });

  it("accepts a token from the adjacent time step (clock drift window)", () => {
    const secret = generateTotpSecret();
    const at = 1_700_000_000_000;
    const token = generateTotpToken(secret, {}, at);
    // 30s later still falls in the +/-1 step window.
    expect(verifyTotpToken(secret, token, {}, 1, at + 30_000)).toBe(true);
  });

  it("rejects a token far outside the window", () => {
    const secret = generateTotpSecret();
    const at = 1_700_000_000_000;
    const token = generateTotpToken(secret, {}, at);
    expect(verifyTotpToken(secret, token, {}, 1, at + 10 * 60_000)).toBe(false);
  });

  it("rejects garbage input without throwing", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpToken(secret, "not-a-code")).toBe(false);
    expect(verifyTotpToken(secret, "12")).toBe(false);
  });

  it("rejects a token generated from a different secret", () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const at = 1_700_000_000_000;
    const token = generateTotpToken(secretA, {}, at);
    expect(verifyTotpToken(secretB, token, {}, 1, at)).toBe(false);
  });

  it("builds a well-formed otpauth:// URI", () => {
    const uri = buildOtpAuthUri({ secretBase32: "ABCD2345", accountName: "owner@rpmpub.example", issuer: "RPM Pub" });
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("secret=ABCD2345");
    expect(uri).toContain("issuer=RPM");
  });

  it("generates unique-looking backup codes in XXXXX-XXXXX form", () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
    }
    expect(new Set(codes).size).toBe(10);
  });

  it("consumes a matching backup code exactly once", () => {
    const codes = generateBackupCodes(3);
    const hashes = codes.map(hashBackupCode);

    const remaining = consumeBackupCode(codes[1], hashes);
    expect(remaining).not.toBeNull();
    expect(remaining).toHaveLength(2);

    // The consumed code no longer matches against the returned hash list.
    expect(consumeBackupCode(codes[1], remaining as string[])).toBeNull();
  });

  it("returns null for a backup code that was never issued", () => {
    const hashes = generateBackupCodes(2).map(hashBackupCode);
    expect(consumeBackupCode("00000-00000", hashes)).toBeNull();
  });

  it("encrypts and decrypts a secret round-trip using BETTER_AUTH_SECRET", async () => {
    const secret = generateTotpSecret();
    const ciphertext = await encryptTotpSecret(secret);
    expect(ciphertext).not.toBe(secret);
    const plaintext = await decryptTotpSecret(ciphertext);
    expect(plaintext).toBe(secret);
  });

  afterAll(() => {
    // no teardown needed; env var left in place is harmless for the rest of
    // the test run.
  });
});
