import { redirect } from "next/navigation";

// Tags moved under the Items hub (/admin/items/tags). Kept as a redirect so
// old bookmarks/links don't 404.
export default function LegacyTagsPage() {
  redirect("/admin/items/tags");
}
