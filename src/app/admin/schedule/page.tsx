import { PlaceholderSection } from "@/components/nav/PlaceholderSection";

// Not yet claimed by a feature unit's owns_paths — the weekly schedule
// editor currently lives conceptually under Settings > Displays (owned by
// the displays unit). Flagged for the orchestrator: point this nav entry
// wherever the schedule editor actually lands, or build it here directly.
export default function SchedulePage() {
  return <PlaceholderSection title="Schedule" />;
}
