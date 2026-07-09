// Client-safe constants for Settings > Menu Behavior (PRD §3.8). Deliberately
// has ZERO imports from src/lib/service/base/** (which pulls in next/cache's
// revalidatePath via bump-affected-screens.ts) — this module is imported
// directly by the "use client" MenuBehaviorSettingsForm.tsx as well as by
// server-side settings/menu-behavior.ts, which re-exports it for backward
// compatibility with other server callers.

export const UNAVAILABLE_TREATMENTS = ["hide", "badge"] as const;
export type UnavailableTreatment = (typeof UNAVAILABLE_TREATMENTS)[number];
