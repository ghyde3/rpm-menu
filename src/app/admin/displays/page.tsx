// Settings > Displays (§3.8): "List of paired displays: name, assigned
// default screen, schedule summary, last-seen heartbeat ..., revoke button.
// 'Pair new display' entry point ... Revoking a token blanks that TV to a
// re-pair screen on its next poll." Also hosts the weekly schedule editor
// (§3.2a) per this unit's spec.
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { listDisplays } from "@/lib/service/displays";
import { listSchedulesForDisplay } from "@/lib/service/schedules";
import { listScreens } from "@/lib/service/screens";
import { Card } from "@/components/ds";
import { HubTabs, DISPLAYS_HUB_TABS } from "@/components/nav/HubTabs";
import { DisplaysManager } from "./DisplaysManager";
import type { ServiceCaller } from "@/lib/service/base";

function OwnerOnlyNotice() {
  return (
    <div>
      <HubTabs tabs={DISPLAYS_HUB_TABS} />
      <h1
        style={{
          fontFamily: "var(--font-display)",
          textTransform: "uppercase",
          color: "var(--accent-primary)",
          fontSize: "var(--fs-h3)",
          margin: 0,
        }}
      >
        Displays
      </h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <Card>
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            Display pairing is owner-only (§3.8). Ask an owner to make changes here.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default async function DisplaysSettingsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "owner") {
    return <OwnerOnlyNotice />;
  }

  const caller: ServiceCaller = {
    actor: { type: "user", id: session.user.id },
    surface: "admin_ui",
    role: session.user.role,
    isActive: session.user.isActive,
  };

  const [displayRows, screenRows] = await Promise.all([listDisplays(db, caller), listScreens(db)]);
  const schedulesByDisplay = Object.fromEntries(
    await Promise.all(
      displayRows.map(async (d) => [d.id, await listSchedulesForDisplay(db, d.id)] as const),
    ),
  );

  return (
    <div>
      <HubTabs tabs={DISPLAYS_HUB_TABS} />
      <h1
        style={{
          fontFamily: "var(--font-display)",
          textTransform: "uppercase",
          color: "var(--accent-primary)",
          fontSize: "var(--fs-h3)",
          margin: 0,
        }}
      >
        Displays
      </h1>
      <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)", marginTop: "var(--sp-2)" }}>
        Paired TVs, pairing codes, and each display&apos;s weekly schedule. Manage the screen layouts they show
        under the Screens tab.
      </p>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <DisplaysManager
          initialDisplays={displayRows}
          screens={screenRows.map((s) => ({ id: s.id, name: s.name }))}
          initialSchedulesByDisplay={schedulesByDisplay}
        />
      </div>
    </div>
  );
}
