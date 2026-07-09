// Shared prop contract for the three layout templates (§3.2: "ship 2-3, not
// a builder" — list/grid/spotlight). Templates are pure presentation: all
// show/hide density decisions were already baked into `items` by
// src/lib/screens/resolve.ts, so a template never re-reads
// `ScreenDisplayOptions` itself beyond the handful of purely-visual knobs
// (accentColor/columns) passed explicitly here.
import type { ResolvedScreenItem } from "@/lib/screens/resolve";

export interface ScreenTemplateProps {
  title: string;
  accentColor?: string;
  /** `grid` template column count (§3.2: "2-3 columns"); ignored by list/spotlight. */
  columns?: number;
  items: ResolvedScreenItem[];
}
