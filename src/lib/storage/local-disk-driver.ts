// Local-disk `StorageProvider` driver (§3.1a) — dev-only default
// (`STORAGE_DRIVER=local`/unset per .env.example). Writes already-processed
// image bytes under `LOCAL_STORAGE_DIR` (default `.uploads/`, gitignored,
// outside `public/` so nothing bypasses the serving route's content-type
// handling) and serves them back via `GET /api/upload/files/[...key]`
// (src/app/api/upload/files/[...key]/route.ts, same owns_path).
//
// Self-registers on import (mirrors the register-a-factory-at-import-time
// pattern documented in interface.ts) — importing this module anywhere sets
// up the "local" driver; src/lib/service/images.ts does that import.
import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { registerStorageDriver, type StorageProvider, type StoragePutInput, type StoragePutResult } from "./interface";

/** `LOCAL_STORAGE_DIR` may be relative (resolved against `process.cwd()`,
 * the `.env.example` default) or absolute (as tests set it, to an isolated
 * temp dir) — `path.join` doesn't reset for an absolute segment mid-path the
 * way `path.resolve` does, so this must branch explicitly. */
function resolvedBaseDir(): string {
  const dir = process.env.LOCAL_STORAGE_DIR ?? ".uploads";
  return isAbsolute(dir) ? dir : join(process.cwd(), dir);
}

/** Resolves `key` to an absolute on-disk path, rejecting any `.`/`..`
 * segment outright — defense in depth even though every caller in this
 * codebase only ever passes keys it generated itself
 * (`images/<uuid>/<variant>.webp`). Checking segments directly (rather than
 * `path.normalize`-then-inspect) avoids relying on normalize's collapsing
 * behavior to catch every traversal shape. */
function resolvePath(key: string): string {
  const segments = key.split(/[\\/]+/).filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Refusing to resolve a storage key with a "." or ".." segment: "${key}"`);
  }
  return join(resolvedBaseDir(), ...segments);
}

class LocalDiskStorageProvider implements StorageProvider {
  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const absPath = resolvePath(input.key);
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, input.body);
    return { key: input.key, url: this.getUrl(input.key) };
  }

  getUrl(key: string): string {
    const segments = key
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment));
    return `/api/upload/files/${segments.join("/")}`;
  }

  async delete(key: string): Promise<void> {
    const absPath = resolvePath(key);
    await rm(absPath, { force: true });
  }
}

registerStorageDriver("local", () => new LocalDiskStorageProvider());
