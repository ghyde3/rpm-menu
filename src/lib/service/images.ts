// Image upload/processing service (PRD §3.1a). Every mutating function
// still Zod-validates its input + role-checks per docs/architecture.md's
// "Service layer" contract, but deliberately does NOT go through
// `withAudit`/`registerRevertHandler`: `images` has no entry in the fixed
// `ENTITY_TYPES` audit registry (src/db/schema/auditLog.ts, foundation-
// owned) — same reason `item_price_variants` writes in
// src/lib/service/items.ts aren't separately audited either. The
// meaningful audited event is when a consuming entity (item/category/
// screen/venue_settings) has its `imageId`/`logoImageId`/
// `backgroundImageKey` field set, which is already covered by the owning
// unit's own `update*` call under the "item"/"category"/etc entity type.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { images } from "@/db/schema";
import { requireStaffOrOwnerCaller, type DbClient, type ServiceCaller } from "./base";
import { NotFoundError } from "./base/errors";
import { processImage, type ImageVariantSpec } from "@/lib/image/process";
import { getStorageProvider } from "@/lib/storage/interface";
import { uploadImageInputSchema, type UploadImageInput } from "@/lib/image/validation";
// Side-effect import: registers the "local" StorageProvider driver so
// `getStorageProvider()` resolves when `STORAGE_DRIVER` is "local" or unset
// (the .env.example default). See local-disk-driver.ts's header comment for
// why a plain import is how drivers register themselves.
import "@/lib/storage/local-disk-driver";

export type Image = typeof images.$inferSelect;

const VARIANT_NAMES: ImageVariantSpec["name"][] = ["thumb", "card", "display"];

export async function getImage(db: DbClient, imageId: string): Promise<Image> {
  const [row] = await db.select().from(images).where(eq(images.id, imageId));
  if (!row) throw new NotFoundError("image", imageId);
  return row;
}

export async function listImages(db: DbClient): Promise<Image[]> {
  return db.select().from(images);
}

/**
 * Validates (magic bytes + decode, §3.1a), processes (EXIF strip,
 * auto-orient, thumb/card/display webp variants), stores each variant via
 * the active `StorageProvider`, and writes the `images` row.
 *
 * Thin route handlers (`src/app/api/upload/route.ts`) are the intended
 * caller. Other feature units' item/category/screen/venue-settings update
 * calls take the returned `id` and set their own `imageId`/`logoImageId`/
 * `backgroundImageKey` field — that write is audited under their entity
 * type, not this one.
 *
 * Throws `UnsupportedImageTypeError` (415) or `ImageTooLargeError` (413)
 * from `processImage` for invalid input; route handlers map `.status`.
 */
export async function uploadImage(
  db: DbClient,
  caller: ServiceCaller,
  buffer: Buffer,
  rawInput: UploadImageInput = {},
): Promise<Image> {
  requireStaffOrOwnerCaller(caller);
  uploadImageInputSchema.parse(rawInput);

  const processed = await processImage(buffer);
  const storage = getStorageProvider();
  const id = randomUUID();
  const keyPrefix = `images/${id}`;

  const puts = await Promise.all(
    processed.variants.map((variant) =>
      storage.put({
        key: `${keyPrefix}/${variant.name}.webp`,
        body: variant.buffer,
        contentType: variant.contentType,
      }),
    ),
  );

  const variantUrls = Object.fromEntries(
    processed.variants.map((variant, i) => [variant.name, puts[i].url] as const),
  );

  try {
    const [row] = await db.insert(images).values({ id, key: keyPrefix, variants: variantUrls }).returning();
    return row;
  } catch (err) {
    // Best-effort cleanup so a failed insert doesn't orphan files forever —
    // not load-bearing (local-disk is dev-only), just tidy.
    await Promise.all(puts.map((p) => storage.delete(p.key).catch(() => undefined)));
    throw err;
  }
}

/** Deletes the image row and every stored variant. Referencing rows
 * (`items.image_id`, `categories.image_id`, `venue_settings.logo_image_id`)
 * all use `onDelete: "set null"` (src/db/schema/catalog.ts,
 * src/db/schema/settings.ts), so this is safe to call without the caller
 * clearing references first. */
export async function deleteImage(db: DbClient, caller: ServiceCaller, imageId: string): Promise<void> {
  requireStaffOrOwnerCaller(caller);
  const row = await getImage(db, imageId);
  const storage = getStorageProvider();

  // Reconstruct each variant's storage key from `row.key` rather than the
  // stored URL (the URL is the served path, not the storage key).
  await Promise.all(VARIANT_NAMES.map((name) => storage.delete(`${row.key}/${name}.webp`)));
  await db.delete(images).where(eq(images.id, imageId));
}
