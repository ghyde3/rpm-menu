import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey, verifyApiKey } from "./hash";

describe("api key hash/verify", () => {
  it("generates a key whose plaintext verifies against its own hash", () => {
    const { plaintext, hash } = generateApiKey();
    expect(plaintext.startsWith("rpm_")).toBe(true);
    expect(verifyApiKey(plaintext, hash)).toBe(true);
  });

  it("rejects an incorrect plaintext", () => {
    const { hash } = generateApiKey();
    expect(verifyApiKey("rpm_not-the-right-key", hash)).toBe(false);
  });

  it("is deterministic for a given plaintext", () => {
    const { plaintext, hash } = generateApiKey();
    expect(hashApiKey(plaintext)).toBe(hash);
  });

  it("never generates the same key twice", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.plaintext).not.toBe(b.plaintext);
  });
});
