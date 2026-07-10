import { redirect } from "next/navigation";

// The Recent Changes / audit feed moved under Settings
// (/admin/settings/audit-log). Kept as a redirect so old "Audit Log" links
// and bookmarks don't 404.
export default function LegacyChangesPage() {
  redirect("/admin/settings/audit-log");
}
