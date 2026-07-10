// TOTP 2FA primitives (§3.8 Settings > Sessions & Security: "optional TOTP
// 2FA for owner accounts"). No `otplib`/`speakeasy` package is preinstalled
// (docs/architecture.md: feature units don't add deps), so this implements
// RFC 4226 (HOTP) + RFC 6238 (TOTP) directly against Node's `crypto` --
// both are short, stable, ~30-year-old algorithms with no moving parts.
//
// Storage note (documented gap, not a silent shortcut): the schema has no
// dedicated two-factor table (src/db/schema/** is foundation-owned and this
// unit's owns_paths don't include it -- "report gaps, don't patch" per the
// build contract). `src/lib/service/settings/sessions.ts` persists the
// encrypted secret + hashed backup codes in the existing `accounts` table
// as a `providerId: "totp"` row -- the same "one row per (user, provider)
// credential" shape Better Auth already uses for `providerId: "credential"`
// (email+password). See that file's module doc for the exact column
// mapping.
import { randomBytes, createHash, createHmac, timingSafeEqual } from "node:crypto";
import { symmetricEncrypt, symmetricDecrypt } from "better-auth/crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32, no padding -- the shape every authenticator app expects
 * for a TOTP secret. */
function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160 bits (20 bytes) -- the RFC 4226-recommended HOTP secret length. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export interface TotpOptions {
  digits?: number;
  periodSeconds?: number;
}

const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD_SECONDS = 30;

/** RFC 4226 HOTP: HMAC-SHA1 over the 8-byte big-endian counter, dynamic
 * truncation, mod 10^digits. */
function hotp(secretBase32: string, counter: number, digits: number): string {
  const key = base32Decode(secretBase32);
  const counterBuf = Buffer.alloc(8);
  // JS numbers are safe integers well past any realistic TOTP counter value
  // (counter only overflows a 32-bit int after ~13,000 years at a 30s step).
  counterBuf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", key).update(counterBuf).digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binCode =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = (binCode % 10 ** digits).toString().padStart(digits, "0");
  return otp;
}

/** RFC 6238 TOTP: HOTP keyed by `floor(unixSeconds / period)`. */
export function generateTotpToken(
  secretBase32: string,
  { digits = DEFAULT_DIGITS, periodSeconds = DEFAULT_PERIOD_SECONDS }: TotpOptions = {},
  atMs: number = Date.now(),
): string {
  const counter = Math.floor(atMs / 1000 / periodSeconds);
  return hotp(secretBase32, counter, digits);
}

/** Verifies a submitted token against +/- `windowSteps` time steps to
 * absorb clock drift/typing lag -- the standard TOTP verification posture. */
export function verifyTotpToken(
  secretBase32: string,
  token: string,
  { digits = DEFAULT_DIGITS, periodSeconds = DEFAULT_PERIOD_SECONDS }: TotpOptions = {},
  windowSteps = 1,
  atMs: number = Date.now(),
): boolean {
  const cleaned = token.replace(/\s+/g, "");
  if (!/^\d+$/.test(cleaned) || cleaned.length !== digits) return false;
  const counter = Math.floor(atMs / 1000 / periodSeconds);
  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const candidate = hotp(secretBase32, counter + delta, digits);
    if (timingSafeEqual(Buffer.from(candidate), Buffer.from(cleaned))) return true;
  }
  return false;
}

/** `otpauth://` URI an authenticator app scans (as a QR or types manually).
 * Label/issuer are URI-encoded per the Google Authenticator key-uri-format
 * convention (the de facto standard every TOTP app follows). */
export function buildOtpAuthUri(opts: { secretBase32: string; accountName: string; issuer: string }): string {
  const label = `${encodeURIComponent(opts.issuer)}:${encodeURIComponent(opts.accountName)}`;
  const params = new URLSearchParams({
    secret: opts.secretBase32,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: String(DEFAULT_DIGITS),
    period: String(DEFAULT_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// --- Backup codes ---------------------------------------------------------

/** Ten single-use recovery codes (e.g. lost authenticator device), formatted
 * `XXXX-XXXX` for easy transcription. Returned plaintext exactly once by the
 * service layer; only the hashes below are persisted. */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex");
}

/** Consumes the first matching hash (if any) and returns the remaining
 * hashes -- callers persist the returned array back so a code can't be
 * reused. Returns `null` if no hash matches. */
export function consumeBackupCode(code: string, hashes: string[]): string[] | null {
  const target = hashBackupCode(code);
  const idx = hashes.findIndex((h) => {
    const a = Buffer.from(h, "hex");
    const b = Buffer.from(target, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (idx === -1) return null;
  return [...hashes.slice(0, idx), ...hashes.slice(idx + 1)];
}

// --- At-rest secret encryption --------------------------------------------
//
// The TOTP secret must be reversible (verification re-derives the token from
// it), unlike a password. `better-auth/crypto`'s `symmetricEncrypt`/
// `symmetricDecrypt` (AES-GCM under the hood) keyed off `BETTER_AUTH_SECRET`
// -- already a required env var (src/lib/auth/config.ts) -- avoids adding a
// second secret to `.env.example` just for this.

function encryptionKey(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET must be set to encrypt/decrypt TOTP secrets");
  }
  return secret;
}

export async function encryptTotpSecret(secretBase32: string): Promise<string> {
  return symmetricEncrypt({ key: encryptionKey(), data: secretBase32 });
}

export async function decryptTotpSecret(ciphertext: string): Promise<string> {
  return symmetricDecrypt({ key: encryptionKey(), data: ciphertext });
}
