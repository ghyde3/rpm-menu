// GET /api/upload/files/<key...> — serves processed image bytes written by
// the local-disk StorageProvider driver (src/lib/storage/local-disk-driver.ts).
// This is the `url` the driver's `getUrl()` hands back; only meaningful when
// `STORAGE_DRIVER=local`/unset (the R2 driver, when it exists, returns real
// CDN URLs instead and this route is never hit).
import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/** Same absolute-vs-relative handling as local-disk-driver.ts's
 * `resolvedBaseDir` — kept in sync deliberately rather than shared, since
 * this route and the driver are each other's only consumer and importing
 * across them would blur the "driver never assumes how it's served" line. */
function resolvedBaseDir(): string {
  const dir = process.env.LOCAL_STORAGE_DIR ?? ".uploads";
  return isAbsolute(dir) ? dir : join(process.cwd(), dir);
}

/** Resolves the requested catch-all segments to an absolute path, rejecting
 * any `.`/`..` segment outright (each raw route param segment is checked on
 * its own, before joining — same approach as local-disk-driver.ts). */
function resolveRequestedPath(rawSegments: string[]): string | null {
  const segments = rawSegments.map((segment) => decodeURIComponent(segment)).filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) return null;
  return join(resolvedBaseDir(), ...segments);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await params;
  const absPath = resolveRequestedPath(segments ?? []);
  if (!absPath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = absPath.slice(absPath.lastIndexOf(".")).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  try {
    const buf = await readFile(absPath);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Every variant is a content-addressed, never-mutated file (a new
        // upload gets a fresh uuid key) — safe to cache aggressively.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
