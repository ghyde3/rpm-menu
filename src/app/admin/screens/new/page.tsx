import { redirect } from "next/navigation";

// Screen create moved into the Displays hub (/admin/displays/screens/new).
export default function LegacyNewScreenPage() {
  redirect("/admin/displays/screens/new");
}
