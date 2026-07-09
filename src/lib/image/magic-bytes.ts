// Magic-byte content-type sniffing (§3.1a: "enforce type ... by magic bytes
// not extension"). Deliberately does not consult any client-supplied
// filename/extension/Content-Type header — those are attacker-controlled.
// SVG (and everything else) is rejected by construction: there is no SVG
// signature in this allow-list, so `detectImageType` returns null for it and
// the caller treats that as unsupported.

export const ALLOWED_IMAGE_TYPES = ["jpeg", "png", "webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function matchesSignature(buf: Buffer, signature: number[]): boolean {
  if (buf.length < signature.length) return false;
  return signature.every((byte, i) => buf[i] === byte);
}

/** Sniffs `buf`'s true format from its leading bytes. Returns null for
 * anything not in `ALLOWED_IMAGE_TYPES` (including SVG, GIF, BMP, TIFF, and
 * non-image bytes). */
export function detectImageType(buf: Buffer): AllowedImageType | null {
  if (matchesSignature(buf, JPEG_SIGNATURE)) return "jpeg";
  if (matchesSignature(buf, PNG_SIGNATURE)) return "png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}
