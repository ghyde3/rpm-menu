import { redirect } from "next/navigation";

// Screens moved into the Displays hub (/admin/displays/screens). Kept as a
// redirect so old bookmarks/links don't 404.
export default function LegacyScreensPage() {
  redirect("/admin/displays/screens");
}
