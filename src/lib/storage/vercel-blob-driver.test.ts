import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the SDK so the driver never touches the network — we only assert the
// driver registers correctly and shape-conforms to the StorageProvider
// contract (what it passes to `put`/`del`, and the url it returns).
const { putMock, delMock } = vi.hoisted(() => ({
  putMock: vi.fn(async (pathname: string, _body: unknown, _opts: unknown) => ({
    url: `https://teststore.public.blob.vercel-storage.com/${pathname}`,
    downloadUrl: `https://teststore.public.blob.vercel-storage.com/${pathname}?download=1`,
    pathname,
    contentType: "image/webp",
    contentDisposition: "inline",
    etag: "test-etag",
  })),
  delMock: vi.fn(async (_urlOrPathname: string | string[], _opts: unknown) => undefined),
}));

vi.mock("@vercel/blob", () => ({ put: putMock, del: delMock }));

import { getStorageProvider, registerStorageDriver } from "./interface";
// Side-effect import: registers the "blob" driver.
import "./vercel-blob-driver";

describe("vercel-blob StorageProvider", () => {
  let originalToken: string | undefined;
  let originalDriver: string | undefined;

  beforeEach(() => {
    originalToken = process.env.BLOB_READ_WRITE_TOKEN;
    originalDriver = process.env.STORAGE_DRIVER;
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_TestStoreId_secretpart";
    process.env.STORAGE_DRIVER = "blob";
    putMock.mockClear();
    delMock.mockClear();
  });

  afterEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    process.env.STORAGE_DRIVER = originalDriver;
  });

  it("registers so getStorageProvider() resolves it when STORAGE_DRIVER=blob", () => {
    // Should not throw the "no driver registered" error.
    expect(() => getStorageProvider()).not.toThrow();
    const provider = getStorageProvider();
    expect(typeof provider.put).toBe("function");
    expect(typeof provider.getUrl).toBe("function");
    expect(typeof provider.delete).toBe("function");
  });

  it("put() uploads public bytes and returns the Blob's public https url", async () => {
    const provider = getStorageProvider();
    const body = Buffer.from("processed webp bytes");

    const result = await provider.put({
      key: "images/abc/display.webp",
      body,
      contentType: "image/webp",
    });

    expect(result.key).toBe("images/abc/display.webp");
    expect(result.url).toBe("https://teststore.public.blob.vercel-storage.com/images/abc/display.webp");

    // Uploaded at the exact key, publicly, overwriting, with the token.
    expect(putMock).toHaveBeenCalledTimes(1);
    const [pathname, passedBody, opts] = putMock.mock.calls[0];
    expect(pathname).toBe("images/abc/display.webp");
    expect(passedBody).toBe(body);
    expect(opts).toMatchObject({
      access: "public",
      contentType: "image/webp",
      token: "vercel_blob_rw_TestStoreId_secretpart",
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  });

  it("delete() removes by key (store-relative pathname) with the token", async () => {
    const provider = getStorageProvider();
    await provider.delete("images/abc/display.webp");
    expect(delMock).toHaveBeenCalledTimes(1);
    const [key, opts] = delMock.mock.calls[0];
    expect(key).toBe("images/abc/display.webp");
    expect(opts).toMatchObject({ token: "vercel_blob_rw_TestStoreId_secretpart" });
  });

  it("getUrl() derives the store's public base url from the token", () => {
    const provider = getStorageProvider();
    // Store id segment is lowercased for the subdomain.
    expect(provider.getUrl("images/abc/card.webp")).toBe(
      "https://teststoreid.public.blob.vercel-storage.com/images/abc/card.webp",
    );
  });

  it("throws a clear error when BLOB_READ_WRITE_TOKEN is unset", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const provider = getStorageProvider();
    await expect(
      provider.put({ key: "images/x/thumb.webp", body: Buffer.from("x"), contentType: "image/webp" }),
    ).rejects.toThrow(/BLOB_READ_WRITE_TOKEN/);
  });

  it("keeps 'blob' registered even after re-registering (idempotent module load)", () => {
    // Sanity: the interface exposes registration; re-registering the same
    // driver key is safe (last factory wins), so importing the module twice
    // never breaks resolution.
    expect(() =>
      registerStorageDriver("blob", () => getStorageProvider()),
    ).not.toThrow();
  });
});
