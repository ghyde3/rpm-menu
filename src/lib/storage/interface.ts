// StorageProvider interface (§3.1a). Foundation owns this contract only —
// concrete drivers (local-disk for dev, R2 for production) are built by the
// image-pipeline unit against it, so image-pipeline never needs to touch
// foundation's files and foundation never needs to know about R2/S3 SDKs.
//
// Never serve user-uploaded bytes unprocessed: drivers store already
// processed (EXIF-stripped, size-limited, magic-byte-validated) buffers only
// — that validation is the image-pipeline unit's job, not the storage
// driver's.

export interface StoragePutInput {
  /** Storage key/path, e.g. `items/<uuid>/display.webp`. */
  key: string;
  /** Already-processed file bytes. */
  body: Buffer | Uint8Array;
  /** MIME type of `body`, e.g. `image/webp`. */
  contentType: string;
}

export interface StoragePutResult {
  key: string;
  /** Publicly reachable URL for `key` (CDN URL for R2, static route for local-disk). */
  url: string;
}

export interface StorageProvider {
  /** Write `body` to `key`, overwriting if it already exists. */
  put(input: StoragePutInput): Promise<StoragePutResult>;
  /** Resolve the public URL for an existing key without re-uploading. */
  getUrl(key: string): string;
  /** Permanently delete the object at `key`. Safe to call on a missing key. */
  delete(key: string): Promise<void>;
}

export type StorageDriver = "local" | "r2";

/** Reads `STORAGE_DRIVER` (see .env.example) — drivers register themselves
 * via `registerStorageDriver` so foundation never imports driver-specific
 * code (sharp/AWS SDK/etc). */
type StorageFactory = () => StorageProvider;
const driverFactories = new Map<StorageDriver, StorageFactory>();

export function registerStorageDriver(driver: StorageDriver, factory: StorageFactory): void {
  driverFactories.set(driver, factory);
}

export function getStorageProvider(): StorageProvider {
  const driver = (process.env.STORAGE_DRIVER as StorageDriver | undefined) ?? "local";
  const factory = driverFactories.get(driver);
  if (!factory) {
    if (driver === "r2") {
      // §3.1a recommends R2 for production (no egress fees for TV polling),
      // and .env.example documents STORAGE_DRIVER=r2 + the R2_* vars, but no
      // R2/S3-compatible driver module has been built yet -- there is
      // nothing to `registerStorageDriver("r2", ...)`. Fail with an
      // actionable message instead of the generic "not registered" one so a
      // deploy that sets STORAGE_DRIVER=r2 fails loudly and clearly at
      // startup rather than looking like a config typo.
      throw new Error(
        'STORAGE_DRIVER="r2" is documented in .env.example as the Phase 1 production target but is not yet ' +
          "implemented in this codebase -- only src/lib/storage/local-disk-driver.ts exists. Implement an R2/S3-" +
          'compatible driver that calls registerStorageDriver("r2", ...) before using this in production, or set ' +
          "STORAGE_DRIVER=local (or leave it unset) until it lands.",
      );
    }
    throw new Error(
      `No StorageProvider registered for STORAGE_DRIVER="${driver}". ` +
        `Import the driver module (e.g. src/lib/storage/local-disk-driver.ts) once at startup to register it.`,
    );
  }
  return factory();
}
