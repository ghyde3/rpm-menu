import { redirect } from "next/navigation";

// The weekly display-schedule editor lives inside the Displays hub
// (/admin/displays) — schedules are per-display, and Displays is the hub that
// manages pairing/revoke/reassignment for the same entities. Kept as a
// redirect so old /admin/schedule links don't 404.
export default function SchedulePage() {
  redirect("/admin/displays");
}
