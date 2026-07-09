// API key generation/hash/verify primitive (§3.7/§3.8). Keys are shown once
// at creation and stored hashed at rest — same posture as display tokens
// (src/lib/auth/display-token.ts, owned by the displays unit) but API keys
// carry scopes instead of a single read-only display grant.
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/** Prefix makes leaked keys greppable/identifiable in logs without exposing
 * the secret itself (the hash is what's compared). */
const KEY_PREFIX = "rpm_";

export interface GeneratedApiKey {
  /** Full secret — shown to the owner exactly once, never stored. */
  plaintext: string;
  /** SHA-256 hex digest — what actually gets persisted in `api_keys.key_hash`. */
  hash: string;
}

/** Generates a new random API key (256 bits of entropy) and its hash. */
export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(32).toString("base64url");
  const plaintext = `${KEY_PREFIX}${secret}`;
  return { plaintext, hash: hashApiKey(plaintext) };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/** Constant-time comparison against a stored hash. */
export function verifyApiKey(plaintext: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashApiKey(plaintext), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}
