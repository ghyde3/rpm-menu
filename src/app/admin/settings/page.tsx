import Link from "next/link";
import { Card } from "@/components/ds";

const SETTINGS_TABS = [
  { label: "Venue", href: "/admin/settings/venue" },
  { label: "Branding", href: "/admin/settings/branding" },
  { label: "Menu Behavior", href: "/admin/settings/menu-behavior" },
  { label: "Users", href: "/admin/settings/users" },
  { label: "Displays", href: "/admin/settings/displays" },
  { label: "API Keys", href: "/admin/settings/api-keys" },
  { label: "Data & Recovery", href: "/admin/settings/data-recovery" },
  { label: "Sessions & Security", href: "/admin/settings/sessions" },
];

// Index/landing for the Settings tabs (§3.8). Each tab is its own route +
// service file, owned by its respective feature unit.
export default function SettingsIndexPage() {
  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          textTransform: "uppercase",
          color: "var(--accent-primary)",
          fontSize: "var(--fs-h3)",
          margin: 0,
        }}
      >
        Settings
      </h1>
      <div
        style={{
          marginTop: "var(--sp-5)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "var(--sp-4)",
        }}
      >
        {SETTINGS_TABS.map((tab) => (
          <Link key={tab.href} href={tab.href}>
            <Card>
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--ls-caps)",
                  color: "var(--text-primary)",
                  fontSize: "0.9375rem",
                }}
              >
                {tab.label}
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
