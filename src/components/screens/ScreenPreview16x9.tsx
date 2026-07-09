// Admin-only 16:9 frame around ScreenRenderer (PRD §3.2: "admin UI renders a
// live 16:9 preview of any screen exactly as the TV renders it (same route,
// same code)"). This file owns the aspect-ratio chrome; ScreenRenderer
// itself is TV-route-reusable and knows nothing about being "a preview."
import { ScreenRenderer } from "./ScreenRenderer";
import type { ResolvedScreen } from "@/lib/screens/resolve";

export function ScreenPreview16x9({ resolved }: { resolved: ResolvedScreen }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 960,
        aspectRatio: "16 / 9",
        border: "var(--bw) solid var(--border-strong)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        boxShadow: "var(--shadow-md, var(--shadow-sm))",
      }}
    >
      <ScreenRenderer resolved={resolved} />
    </div>
  );
}
