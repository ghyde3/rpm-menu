// Shared layout for the Settings hub and its sub-pages. Renders a consistent
// "← Back to Settings" link above every sub-page's content; the link hides
// itself on the Settings index (/admin/settings) — see BackToSettings.
import type { ReactNode } from "react";
import { BackToSettings } from "./_components/BackToSettings";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <BackToSettings />
      {children}
    </div>
  );
}
