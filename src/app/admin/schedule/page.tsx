import { redirect } from "next/navigation";

// The weekly display-schedule editor lives inside Settings > Displays
// (§3.2a/§3.8 — schedules are per-display, and Displays is already the
// owner-only settings tab that manages pairing/revoke/reassignment for the
// same entities). This nav entry was flagged in docs/architecture.md as
// unowned with instructions to "point elsewhere or claim directly" — this
// unit claims it and redirects rather than duplicating the editor UI.
export default function SchedulePage() {
  redirect("/admin/settings/displays");
}
