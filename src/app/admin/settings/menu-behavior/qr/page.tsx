// The QR code generator was promoted to its own top-level Settings item at
// /admin/settings/qr. This legacy nested route permanently redirects there so
// no old link or bookmark 404s.
import { redirect } from "next/navigation";

export default function LegacyMenuQrRedirect() {
  redirect("/admin/settings/qr");
}
