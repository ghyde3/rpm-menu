import { describe, expect, it, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/db/test-db";
import type { Database } from "@/db";
import { images } from "@/db/schema";
import { uploadImage, deleteImage, getImage } from "./images";
import { UnsupportedImageTypeError } from "@/lib/image/errors";
import type { ServiceCaller } from "./base";

const owner: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000aa" },
  surface: "admin_ui",
  role: "owner",
  isActive: true,
};

const noRole: ServiceCaller = {
  actor: { type: "user", id: "00000000-0000-0000-0000-0000000000bb" },
  surface: "admin_ui",
  role: undefined,
  isActive: true,
};

async function makeJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 10, g: 200, b: 30 } } })
    .jpeg()
    .toBuffer();
}

describe("images service", () => {
  let db: Database;
  let storageDir: string;
  let originalEnv: string | undefined;

  beforeAll(async () => {
    db = await createTestDb();
  });

  beforeEach(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "rpm-menu-images-test-"));
    originalEnv = process.env.LOCAL_STORAGE_DIR;
    process.env.LOCAL_STORAGE_DIR = storageDir;
  });

  afterEach(async () => {
    process.env.LOCAL_STORAGE_DIR = originalEnv;
    await rm(storageDir, { recursive: true, force: true });
  });

  it("processes and stores an upload, writing the images row and on-disk variants", async () => {
    const jpeg = await makeJpeg();
    const image = await uploadImage(db, owner, jpeg, { filename: "burger.jpg" });

    expect(image.key).toBe(`images/${image.id}`);
    expect(Object.keys(image.variants).sort()).toEqual(["card", "display", "thumb"]);
    expect(image.variants.thumb).toBe(`/api/upload/files/images/${image.id}/thumb.webp`);

    for (const name of ["thumb", "card", "display"] as const) {
      const onDisk = await readFile(join(storageDir, "images", image.id, `${name}.webp`));
      const meta = await sharp(onDisk).metadata();
      expect(meta.format).toBe("webp");
    }

    const fetched = await getImage(db, image.id);
    expect(fetched.id).toBe(image.id);
  });

  it("rejects an upload from a non-staff/owner actor", async () => {
    const jpeg = await makeJpeg();
    await expect(uploadImage(db, noRole, jpeg)).rejects.toThrow();
  });

  it("rejects a non-image upload (magic-byte validation)", async () => {
    const notAnImage = Buffer.from("hello, this is definitely not an image");
    await expect(uploadImage(db, owner, notAnImage)).rejects.toBeInstanceOf(UnsupportedImageTypeError);
  });

  it("rejects an SVG upload even with an image-ish filename", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf8");
    await expect(uploadImage(db, owner, svg, { filename: "logo.svg" })).rejects.toBeInstanceOf(
      UnsupportedImageTypeError,
    );
  });

  it("deleteImage removes the row and every stored variant file", async () => {
    const jpeg = await makeJpeg();
    const image = await uploadImage(db, owner, jpeg);

    await deleteImage(db, owner, image.id);

    const rows = await db.select().from(images).where(eq(images.id, image.id));
    expect(rows).toHaveLength(0);

    await expect(readFile(join(storageDir, "images", image.id, "thumb.webp"))).rejects.toThrow();
  });

  it("rejects delete from a non-staff/owner actor", async () => {
    const jpeg = await makeJpeg();
    const image = await uploadImage(db, owner, jpeg);
    await expect(deleteImage(db, noRole, image.id)).rejects.toThrow();
  });

  it("getImage throws NotFoundError for a missing id", async () => {
    await expect(getImage(db, "00000000-0000-0000-0000-000000000000")).rejects.toThrow();
  });
});
