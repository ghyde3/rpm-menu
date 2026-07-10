// GET /api/menu-qr?format=svg|png&size=<px> -- the print-ready QR download
// endpoint backing Settings > Menu Behavior > QR Code (§3.8: "renders/
// downloads a print-ready QR (SVG + PNG) pointing at the public menu").
// Owner-authenticated (same posture as every other Settings surface) --
// this is a download link used from within the admin UI, not a public
// asset; the public menu itself doesn't need a server-rendered QR image.
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getPublicMenuUrl, generateMenuQrSvg, generateMenuQrPng } from "@/lib/qr";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "owner") {
    return NextResponse.json({ error: "Owner authentication required" }, { status: 401 });
  }

  const format = req.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";
  const download = req.nextUrl.searchParams.get("download") === "1";
  const sizeParam = req.nextUrl.searchParams.get("size");
  const sizePx = sizeParam ? Math.min(Math.max(parseInt(sizeParam, 10) || 1024, 128), 4096) : undefined;

  const url = getPublicMenuUrl();

  if (format === "png") {
    const png = await generateMenuQrPng(url, { sizePx });
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=0, no-cache",
        ...(download ? { "Content-Disposition": 'attachment; filename="rpm-menu-qr.png"' } : {}),
      },
    });
  }

  const svg = await generateMenuQrSvg(url);
  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=0, no-cache",
      ...(download ? { "Content-Disposition": 'attachment; filename="rpm-menu-qr.svg"' } : {}),
    },
  });
}
