import { redirect } from "next/navigation";

// Category detail moved under the Items hub
// (/admin/items/categories/[id]). Kept as a redirect so old links don't 404.
export default async function LegacyCategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/items/categories/${id}`);
}
