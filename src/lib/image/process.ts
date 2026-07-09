// Server-side image processing (§3.1a): EXIF strip + auto-orient, magic-byte
// validated input, sized webp variant generation. The only place sharp is
// imported in the image-pipeline unit — StorageProvider drivers and the
// route handler never touch pixels directly.
import sharp from "sharp";
import { detectImageType, ALLOWED_IMAGE_TYPES, type AllowedImageType } from "./magic-bytes";
import { ImageTooLargeError, UnsupportedImageTypeError } from "./errors";

/** 10MB-in limit (§3.1a). */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;

/** webp-out (§3.1a) at this quality for every variant. */
const WEBP_QUALITY = 82;

export interface ImageVariantSpec {
  name: "thumb" | "card" | "display";
  /** Target max width in px; never upscales past the source's own width. */
  width: number;
}

/** thumb / card / display(~1920w) per §3.1a. */
export const VARIANT_SPECS: ImageVariantSpec[] = [
  { name: "thumb", width: 200 },
  { name: "card", width: 600 },
  { name: "display", width: 1920 },
];

export interface ProcessedVariant {
  name: ImageVariantSpec["name"];
  buffer: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
}

export interface ProcessedImage {
  sourceType: AllowedImageType;
  variants: ProcessedVariant[];
}

/**
 * Validates `input` is a real jpeg/png/webp (magic bytes, then a sharp
 * decode as a second check — catches truncated/polyglot files that pass the
 * cheap byte sniff but don't actually decode), then produces the thumb/card/
 * display webp variants with EXIF stripped and orientation baked in.
 *
 * Throws `ImageTooLargeError` or `UnsupportedImageTypeError` — never returns
 * a value for input that isn't a clean, decodable jpeg/png/webp. Never
 * accepts SVG: there is no SVG entry in the magic-byte allow-list, and even
 * if one slipped past that (it can't), the format check below only accepts
 * `ALLOWED_IMAGE_TYPES`.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength > MAX_INPUT_BYTES) {
    throw new ImageTooLargeError(MAX_INPUT_BYTES);
  }

  const sniffed = detectImageType(input);
  if (!sniffed) {
    throw new UnsupportedImageTypeError();
  }

  const metadata = await sharp(input, { failOn: "error" })
    .metadata()
    .catch(() => null);
  if (!metadata) {
    throw new UnsupportedImageTypeError("Could not decode the uploaded file as an image.");
  }

  if (!metadata.format || !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(metadata.format)) {
    throw new UnsupportedImageTypeError();
  }

  const variants: ProcessedVariant[] = [];
  for (const spec of VARIANT_SPECS) {
    // Fresh sharp() per variant from the original buffer — cheaper and
    // simpler than cloning a pipeline, and each variant needs its own
    // resize target anyway.
    const pipeline = sharp(input)
      // Bakes EXIF orientation into pixel data before we drop metadata below,
      // so stripped output never renders sideways/upside-down.
      .rotate()
      .resize({ width: spec.width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY });
    // Not calling `.withMetadata()` is what strips EXIF/ICC/XMP (§3.1a) —
    // sharp only carries source metadata through when explicitly asked to.
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    variants.push({
      name: spec.name,
      buffer: data,
      contentType: "image/webp",
      width: info.width,
      height: info.height,
    });
  }

  return { sourceType: sniffed, variants };
}
