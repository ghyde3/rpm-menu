// Vercel Blob `StorageProvider` driver (§3.1a) — the production storage
// target (`STORAGE_DRIVER=blob`). Vercel's serverless/edge filesystem is
// ephemeral, so the local-disk driver's `.uploads/` dir does not survive a
// deploy or scale event — uploaded image bytes must live in a durable object
// store. This driver writes each already-processed variant buffer to a Vercel
// Blob store (via `@vercel/blob`) with `access: 'public'` and persists the
// Blob's own public https URL.
//
// KEY DIFFERENCE FROM local-disk: a Blob's public URL
// (`https://<store>.public.blob.vercel-storage.com/<key>`) is directly
// reachable by browsers/TV displays — it does NOT get proxied through
// `GET /api/upload/files/...` the way the local driver's URLs do. So `put()`
// returns that public URL as the value persisted into `images.variants`, and
// no app route ever serves these bytes.
//
// Self-registers on import (same register-a-factory-at-import-time pattern as
// local-disk-driver.ts) — importing this module anywhere sets up the "blob"
// driver. `src/lib/service/images.ts` side-effect-imports it (alongside the
// local driver) so `getStorageProvider()` resolves it when
// `STORAGE_DRIVER=blob`, without foundation ever importing the SDK itself.
import { put, del } from "@vercel/blob";
import { registerStorageDriver, type StorageProvider, type StoragePutInput, type StoragePutResult } from "./interface";

/** Reads the store's read-write token. Required for every operation; failing
 * loudly here (rather than letting `@vercel/blob` throw a less specific
 * error deep in an upload) makes a misconfigured production deploy obvious. */
function requireToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      'STORAGE_DRIVER="blob" requires BLOB_READ_WRITE_TOKEN to be set (create a Vercel Blob store and copy its ' +
        "read/write token — see docs/DEPLOY.md). It is unset.",
    );
  }
  return token;
}

/** Derives the store's public base URL from the read-write token, whose shape
 * is `vercel_blob_rw_<storeId>_<secret>`; public blobs are served from
 * `https://<storeId>.public.blob.vercel-storage.com/<key>` (lowercased host).
 *
 * Only used by `getUrl()` — the pipeline persists the exact URL `put()`
 * returns from the API, never a reconstructed one, so this derivation is a
 * best-effort convenience for callers that need a URL for an already-stored
 * key without a round-trip. */
function publicBaseUrl(token: string): string {
  const storeId = token.split("_")[3];
  if (!storeId) {
    throw new Error("BLOB_READ_WRITE_TOKEN is malformed: expected the form vercel_blob_rw_<storeId>_<secret>.");
  }
  return `https://${storeId.toLowerCase()}.public.blob.vercel-storage.com`;
}

class VercelBlobStorageProvider implements StorageProvider {
  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const token = requireToken();
    // `@vercel/blob`'s PutBody accepts Buffer (not a bare Uint8Array); the
    // pipeline always hands us a Buffer, but normalize defensively.
    const body = Buffer.isBuffer(input.body) ? input.body : Buffer.from(input.body);
    const result = await put(input.key, body, {
      access: "public",
      contentType: input.contentType,
      token,
      // Store bytes at exactly `input.key` (`images/<uuid>/<variant>.webp`) so
      // keys stay content-addressed and predictable — no random suffix.
      addRandomSuffix: false,
      // The interface contract is "write, overwriting if it already exists";
      // @vercel/blob throws on an existing key unless this is set.
      allowOverwrite: true,
    });
    // Persist the API-returned public URL verbatim (this is what lands in
    // `images.variants` and is served directly to browsers/displays).
    return { key: input.key, url: result.url };
  }

  getUrl(key: string): string {
    return `${publicBaseUrl(requireToken())}/${key}`;
  }

  async delete(key: string): Promise<void> {
    // `del` accepts a store-relative pathname (not just a full URL) and is a
    // no-op for a key that no longer exists, satisfying the interface's
    // "safe to call on a missing key" contract.
    await del(key, { token: requireToken() });
  }
}

registerStorageDriver("blob", () => new VercelBlobStorageProvider());
