import { redirect } from "next/navigation";

// Screen detail moved into the Displays hub (/admin/displays/screens/[id]).
export default async function LegacyScreenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/displays/screens/${id}`);
}
