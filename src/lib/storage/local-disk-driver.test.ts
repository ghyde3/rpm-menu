import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getStorageProvider } from "./interface";
// Side-effect import: registers the "local" driver.
import "./local-disk-driver";

describe("local-disk StorageProvider", () => {
  let dir: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "rpm-menu-storage-test-"));
    originalEnv = process.env.LOCAL_STORAGE_DIR;
    process.env.LOCAL_STORAGE_DIR = dir;
  });

  afterEach(async () => {
    process.env.LOCAL_STORAGE_DIR = originalEnv;
    await rm(dir, { recursive: true, force: true });
  });

  it("writes bytes to disk under the configured base dir and returns a servable url", async () => {
    const provider = getStorageProvider();
    const body = Buffer.from("hello world");

    const result = await provider.put({ key: "images/abc/thumb.webp", body, contentType: "image/webp" });

    expect(result.key).toBe("images/abc/thumb.webp");
    expect(result.url).toBe("/api/upload/files/images/abc/thumb.webp");

    const onDisk = await readFile(join(dir, "images/abc/thumb.webp"));
    expect(onDisk.equals(body)).toBe(true);
  });

  it("getUrl resolves without re-uploading", () => {
    const provider = getStorageProvider();
    expect(provider.getUrl("images/abc/card.webp")).toBe("/api/upload/files/images/abc/card.webp");
  });

  it("delete removes the object, and is a safe no-op on a missing key", async () => {
    const provider = getStorageProvider();
    await provider.put({ key: "images/xyz/display.webp", body: Buffer.from("x"), contentType: "image/webp" });

    await provider.delete("images/xyz/display.webp");
    await expect(readFile(join(dir, "images/xyz/display.webp"))).rejects.toThrow();

    // Deleting an already-missing key must not throw.
    await expect(provider.delete("images/xyz/display.webp")).resolves.toBeUndefined();
  });

  it("rejects a storage key that attempts to traverse outside the base dir", async () => {
    const provider = getStorageProvider();
    await expect(
      provider.put({ key: "../../etc/passwd", body: Buffer.from("x"), contentType: "image/webp" }),
    ).rejects.toThrow();
  });
});
