"use client";

// A consistent "← Back to Settings" link rendered at the top of every
// Settings sub-page via the settings layout. It hides itself on the Settings
// index (/admin/settings) so the hub grid never links back to itself.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const STYLE = `
  .back-to-settings {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-4);
    padding: var(--sp-1) 0;
    font-family: var(--font-heading);
    text-transform: uppercase;
    letter-spacing: var(--ls-caps);
    font-size: 0.8125rem;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: var(--radius-sm);
    transition: color var(--dur) var(--ease);
  }
  .back-to-settings:hover { color: var(--accent-primary); }
  .back-to-settings:focus-visible {
    outline: 2px solid var(--accent-primary);
    outline-offset: 3px;
  }
`;

export function BackToSettings() {
  const pathname = usePathname();

  // The Settings index itself must not show a back-to-settings link.
  if (pathname === "/admin/settings") return null;

  return (
    <>
      <style>{STYLE}</style>
      <Link href="/admin/settings" className="back-to-settings">
        <ArrowLeft size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span>Back to Settings</span>
      </Link>
    </>
  );
}
