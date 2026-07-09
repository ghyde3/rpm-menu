// POST /api/upload (§3.1a) — thin wrapper over the image-pipeline service
// layer. Accepts `multipart/form-data` with a `file` field (drag-drop or
// mobile camera capture from the admin UI), validates/processes it, and
// returns the created `images` row so the calling feature (items/
// categories/screens/venue-settings admin UI) can set its own
// `imageId`/`logoImageId`/`backgroundImageKey` field.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/role-guard";
import { uploadImage, deleteImage } from "@/lib/service/images";
import type { ServiceCaller } from "@/lib/service/base";

function errorStatus(err: unknown): number {
  if (err && typeof err === "object" && "status" in err && typeof err.status === "number") {
    return err.status;
  }
  return 500;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Upload failed";
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const caller: ServiceCaller = {
    actor: { type: "user", id: session.user.id },
    surface: "admin_ui",
    role: session.user.role,
    isActive: session.user.isActive,
  };

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing \"file\" field" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const image = await uploadImage(db, caller, buffer, {
      filename: file.name || undefined,
    });
    return NextResponse.json({ image }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: errorMessage(err) }, { status: errorStatus(err) });
  }
}

/** DELETE /api/upload?id=<uuid> — removes an `images` row and its stored
 * variants. Used by consuming units when an item/category/screen image is
 * replaced or cleared (they clear their own `imageId` field first via their
 * own audited update call, then call this to reclaim storage). */
export async function DELETE(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const caller: ServiceCaller = {
    actor: { type: "user", id: session.user.id },
    surface: "admin_ui",
    role: session.user.role,
    isActive: session.user.isActive,
  };

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing \"id\" query param" }, { status: 400 });
  }

  try {
    await deleteImage(db, caller, id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: errorMessage(err) }, { status: errorStatus(err) });
  }
}
