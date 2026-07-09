// Error types for the image-upload pipeline (§3.1a). Route handlers map
// `.status` onto the HTTP response the same way AuthError/NotFoundError are
// mapped elsewhere in the service layer (docs/architecture.md).

/** The uploaded bytes aren't a supported image (failed magic-byte sniffing,
 * failed sharp decode, or decoded to a disallowed format like svg/gif). */
export class UnsupportedImageTypeError extends Error {
  status = 415;
  constructor(message = "Unsupported image type. Only JPEG, PNG, and WEBP are accepted.") {
    super(message);
    this.name = "UnsupportedImageTypeError";
  }
}

/** Input buffer exceeds the 10MB-in limit (§3.1a). */
export class ImageTooLargeError extends Error {
  status = 413;
  constructor(maxBytes: number) {
    super(`Image exceeds the ${Math.floor(maxBytes / (1024 * 1024))}MB upload limit.`);
    this.name = "ImageTooLargeError";
  }
}
