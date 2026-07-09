// Client-safe constants for Settings > Branding (PRD §3.8). Deliberately
// has ZERO imports from src/lib/service/base/** (which pulls in next/cache's
// revalidatePath via bump-affected-screens.ts) — this module is imported
// directly by the "use client" BrandingSettingsForm.tsx as well as by
// server-side settings/branding.ts, which re-exports these for backward
// compatibility with other server callers (e.g. src/lib/menu/public-query.ts).
//
// Font scope decision: the design system (`RPM Pub Design System/tokens/
// fonts.css`) loads exactly four webfonts globally (Anton, Oswald, Zilla
// Slab, Bungee) via one `@import`. Rather than introducing a fifth+ font
// family, the curated set below reuses those four already-loaded families
// as the public-menu/screen default.

export const BRANDING_FONT_OPTIONS = [
  { value: "zilla-slab", label: "Zilla Slab — Classic Slab" },
  { value: "oswald", label: "Oswald — Condensed Grotesque" },
  { value: "anton", label: "Anton — Heavy Impact" },
  { value: "bungee", label: "Bungee — Signage Accent" },
] as const;
export type BrandingFont = (typeof BRANDING_FONT_OPTIONS)[number]["value"];
export const BRANDING_FONT_VALUES = BRANDING_FONT_OPTIONS.map((f) => f.value) as [
  BrandingFont,
  ...BrandingFont[],
];

/** CSS font-family stacks for each curated choice, for consuming surfaces
 * (public menu, screen templates) to resolve `branding.font` with. */
export const BRANDING_FONT_STACKS: Record<BrandingFont, string> = {
  "zilla-slab": "'Zilla Slab', Georgia, serif",
  oswald: "'Oswald', 'Arial Narrow', sans-serif",
  anton: "'Anton', 'Arial Narrow', sans-serif",
  bungee: "'Bungee', 'Arial Black', sans-serif",
};

/** Curated one-click swatches offered in the admin UI. The underlying field
 * still accepts any 6-digit hex — §3.8 restricts *font* choice, not color —
 * so an owner can fine-tune beyond these presets. */
export const BRANDING_COLOR_SWATCHES = [
  { value: "#d63a2c", label: "Hot-Rod Red" },
  { value: "#e8632a", label: "Flame Orange" },
  { value: "#e5b833", label: "Beer Amber" },
  { value: "#a8c81e", label: "Kustom Green" },
] as const;
