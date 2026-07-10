import { redirect } from "next/navigation";

// Displays management was promoted from a Settings tab to its own top-level
// hub (/admin/displays). Kept as a redirect so old links don't 404.
export default function LegacySettingsDisplaysPage() {
  redirect("/admin/displays");
}
