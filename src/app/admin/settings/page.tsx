import Link from "next/link";
import {
  Building2,
  Palette,
  SlidersHorizontal,
  Users,
  KeyRound,
  ScrollText,
  DatabaseBackup,
  ShieldCheck,
  QrCode,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ds";

// Displays is no longer a Settings tab — it was promoted to its own top-level
// hub (/admin/displays). API Keys and Audit Log live here as Settings
// sections. QR was promoted from settings/menu-behavior/qr to its own tile.
const SETTINGS_TABS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Venue", href: "/admin/settings/venue", icon: Building2 },
  { label: "Branding", href: "/admin/settings/branding", icon: Palette },
  { label: "Menu Behavior", href: "/admin/settings/menu-behavior", icon: SlidersHorizontal },
  { label: "Users", href: "/admin/settings/users", icon: Users },
  { label: "API Keys", href: "/admin/settings/api-keys", icon: KeyRound },
  { label: "Audit Log", href: "/admin/settings/audit-log", icon: ScrollText },
  { label: "Data & Recovery", href: "/admin/settings/data-recovery", icon: DatabaseBackup },
  { label: "Sessions & Security", href: "/admin/settings/sessions", icon: ShieldCheck },
  { label: "QR", href: "/admin/settings/qr", icon: QrCode },
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
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link key={tab.href} href={tab.href}>
              <Card>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--sp-3)",
                  }}
                >
                  <Icon
                    size={20}
                    aria-hidden="true"
                    style={{ flexShrink: 0, color: "var(--accent-primary)" }}
                  />
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
                </span>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
