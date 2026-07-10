// Reproducible menu-photo seed. Attaches the committed demo food photos
// (seed-assets/menu-photos/, described by menu-photos.json) to their items
// through the SAME pipeline the admin UI uses — `uploadImage` (processes +
// stores via the ACTIVE StorageProvider: local-disk in dev, Vercel Blob in
// prod) then `addItemImage` (first image per item becomes the hero/primary).
//
// This is what makes the demo fully reproducible on any environment/driver:
// `db:reset && db:migrate && db:seed` rebuilds the menu (import-menu.ts) AND
// re-uploads every photo from committed source bytes — nothing is wired by
// hand. Guarded idempotently per item (skips an item that already has a
// gallery), mirroring import-menu.ts's "items already exist -> skip" guard.
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { items, itemImages } from "@/db/schema";
import type { ServiceCaller } from "@/lib/service/base";
import { uploadImage } from "@/lib/service/images";
import { addItemImage } from "@/lib/service/item-images";

const MANIFEST_PATH = path.resolve(process.cwd(), "scripts/seed/menu-photos.json");
const ASSETS_DIR = path.resolve(process.cwd(), "seed-assets/menu-photos");

// Same system attribution as the menu import — every upload/gallery write is
// recorded as actor_type=system / surface=system in the audit log.
const SYSTEM_CALLER: ServiceCaller = { actor: { type: "system", id: null }, surface: "system" };

interface PhotoManifestEntry {
  item: string;
  files: string[];
}
interface PhotoManifest {
  photos: PhotoManifestEntry[];
}

/** Minimum number of items expected to end up with a hero image — a hard
 * lower bound so a silently-truncated manifest or a broken pipeline fails the
 * seed loudly rather than shipping a photo-less demo. */
const MIN_ITEMS_WITH_HERO = 55;
/** Items whose manifest gallery has 3+ photos must still have 3+ in the DB. */
const MIN_GALLERY_SIZE = 3;

function loadManifest(): PhotoManifest {
  const raw = readFileSync(MANIFEST_PATH, "utf-8");
  const manifest = JSON.parse(raw) as PhotoManifest;
  if (!Array.isArray(manifest.photos)) {
    throw new Error(`menu-photos.json is malformed: expected a { photos: [...] } object.`);
  }
  return manifest;
}

export async function importPhotos(db: Database): Promise<void> {
  const manifest = loadManifest();
  console.log(`Attaching menu photos: ${manifest.photos.length} items from ${MANIFEST_PATH} ...`);

  // Map item name -> id. Names are the manifest key; guard against ambiguity.
  const allItems = await db.select({ id: items.id, name: items.name }).from(items);
  const idByName = new Map<string, string>();
  const dupeNames = new Set<string>();
  for (const row of allItems) {
    if (idByName.has(row.name)) dupeNames.add(row.name);
    idByName.set(row.name, row.id);
  }

  let itemsProcessed = 0;
  let itemsSkipped = 0;
  let photosUploaded = 0;

  for (const entry of manifest.photos) {
    const itemId = idByName.get(entry.item);
    if (!itemId) {
      throw new Error(`Photo manifest references item "${entry.item}" which does not exist in the menu.`);
    }
    if (dupeNames.has(entry.item)) {
      throw new Error(`Photo manifest item name "${entry.item}" is ambiguous (multiple items share it).`);
    }

    // Idempotency guard: skip an item that already has a gallery (re-run,
    // like import-menu.ts skips when items already exist).
    const [{ count: existing }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(itemImages)
      .where(eq(itemImages.itemId, itemId));
    if (existing > 0) {
      itemsSkipped++;
      continue;
    }

    for (const file of entry.files) {
      const buffer = readFileSync(path.join(ASSETS_DIR, file));
      // Real pipeline: process + store via the active driver, then attach.
      // The first file added to an item is auto-marked primary (hero) by
      // addItemImage — manifest files[0] is the item's primary photo.
      const image = await uploadImage(db, SYSTEM_CALLER, buffer, { filename: file });
      await addItemImage(db, SYSTEM_CALLER, itemId, { imageId: image.id });
      photosUploaded++;
    }
    itemsProcessed++;
  }

  console.log(
    `Menu photos: ${itemsProcessed} items attached (${photosUploaded} photos), ${itemsSkipped} already had a gallery (skipped).`,
  );

  // === Hard assertions =====================================================
  // Run against final DB state (whether we imported or skipped), so a re-run
  // still validates the demo is intact.
  const [{ count: itemsWithHero }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(items)
    .where(sql`${items.imageId} is not null`);
  if (itemsWithHero < MIN_ITEMS_WITH_HERO) {
    throw new Error(
      `Assertion failed: expected at least ${MIN_ITEMS_WITH_HERO} items with a hero image, found ${itemsWithHero}.`,
    );
  }

  const galleryItems = manifest.photos.filter((p) => p.files.length >= MIN_GALLERY_SIZE);
  for (const entry of galleryItems) {
    const itemId = idByName.get(entry.item)!;
    const [{ count: galleryCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(itemImages)
      .where(eq(itemImages.itemId, itemId));
    if (galleryCount < MIN_GALLERY_SIZE) {
      throw new Error(
        `Assertion failed: gallery item "${entry.item}" has ${galleryCount} photos, expected >= ${MIN_GALLERY_SIZE}.`,
      );
    }
  }

  console.log("All photo-seed assertions passed:");
  console.log(`  items with a hero image = ${itemsWithHero} (>= ${MIN_ITEMS_WITH_HERO})`);
  console.log(`  multi-photo gallery items (>= ${MIN_GALLERY_SIZE}) = ${galleryItems.length}`);
}
