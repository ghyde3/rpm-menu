// Display token + pairing-code primitives (PRD §3.3, §3.6: "Display tokens:
// random 256-bit, hashed at rest, scoped to one display, read-only endpoints
// only, revocable individually"). Mirrors src/lib/api-keys/hash.ts's
// generate/hash/verify shape exactly — same posture, different holder (a TV,
// not an admin) and a single implicit read-only "scope" rather than a scopes
// array.
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

export interface GeneratedDisplayToken {
  /** Full secret — delivered to the TV exactly once (at the moment its
   * pairing code is claimed), never stored. */
  plaintext: string;
  /** SHA-256 hex digest — what actually gets persisted in
   * `displays.token_hash`. */
  hash: string;
}

/** Generates a new random display token (256 bits of entropy) and its hash. */
export function generateDisplayToken(): GeneratedDisplayToken {
  const secret = randomBytes(32).toString("base64url");
  return { plaintext: secret, hash: hashDisplayToken(secret) };
}

export function hashDisplayToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/** Constant-time comparison against a stored hash. */
export function verifyDisplayToken(plaintext: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashDisplayToken(plaintext), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

/** Alphabet deliberately excludes visually-ambiguous characters (0/O, 1/I/L)
 * — the code is hand-typed by an owner reading it off a TV across the room
 * (§3.3: "TV navigates to /display -> shows a 6-character pairing code"). */
const PAIRING_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Generates a random 6-character pairing code from the unambiguous
 * alphabet above (~32^6 ≈ 1.07 billion combinations — collision-checked by
 * the caller, brute-force-resistant within the short pairing window). */
export function generatePairingCode(): string {
  let code = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += PAIRING_CODE_ALPHABET[bytes[i] % PAIRING_CODE_ALPHABET.length];
  }
  return code;
}
