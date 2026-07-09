// Settings > Venue (§3.8). Owned by the settings-venue-users unit.
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { getVenueSettings } from "@/lib/service/settings/venue";
import { Card } from "@/components/ds";
import { VenueSettingsForm } from "./VenueSettingsForm";

function OwnerOnlyNotice() {
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
        Settings · Venue
      </h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <Card>
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            Venue settings are owner-only (§3.8). Ask an owner to make changes here.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default async function VenueSettingsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "owner") {
    return <OwnerOnlyNotice />;
  }

  const settings = await getVenueSettings(db);

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
        Settings · Venue
      </h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <VenueSettingsForm initialSettings={settings} />
      </div>
    </div>
  );
}
