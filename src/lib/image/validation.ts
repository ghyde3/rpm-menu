// Zod validation for the upload service boundary (§3.6: "Zod for validation
// at every service-boundary input"). The uploaded bytes themselves aren't
// Zod-shaped data — they're validated structurally by magic-byte sniffing +
// a sharp decode (src/lib/image/process.ts) — but the request metadata that
// travels alongside the file is validated here, the same as every other
// domain's `src/lib/validation/*.ts` file.
import { z } from "zod";

export const uploadImageInputSchema = z.object({
  /** Original filename, kept only for diagnostics/logging — never trusted
   * for content-type or storage-key derivation (see magic-bytes.ts header
   * comment). Optional: browser drag-drop and camera capture don't always
   * supply one. */
  filename: z.string().min(1).max(255).optional(),
});
export type UploadImageInput = z.infer<typeof uploadImageInputSchema>;
