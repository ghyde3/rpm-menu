import { redirect } from "next/navigation";

// Categories moved under the Items hub (/admin/items/categories). Kept as a
// redirect so old bookmarks/links don't 404.
export default function LegacyCategoriesPage() {
  redirect("/admin/items/categories");
}
