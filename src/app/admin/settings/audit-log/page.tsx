// Recent Changes / audit log admin page (PRD §3.5 + §9 M3). Owned by the
// changes-bulk-ops-and-revert unit.
import Link from "next/link";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { ENTITY_TYPES } from "@/db/schema";
import { listRecentChanges, listChangeActors } from "@/lib/service/revert";
import type { ServiceCaller } from "@/lib/service/base";
import { Button, Card } from "@/components/ds";
import { ChangesFeed, type ChangeEntryDTO } from "./ChangesFeed";

export default async function ChangesPage() {
  const session = await getCurrentSession();
  if (!session) {
    return (
      <div>
        <Card>
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)", margin: 0 }}>
            Sign in to view recent changes.
          </p>
        </Card>
      </div>
    );
  }

  const caller: ServiceCaller = {
    actor: { type: "user", id: session.user.id },
    surface: "admin_ui",
    role: session.user.role,
    isActive: session.user.isActive,
  };

  const [changes, actors] = await Promise.all([
    listRecentChanges(db, caller, { limit: 150 }),
    listChangeActors(db, caller),
  ]);

  const changeDtos: ChangeEntryDTO[] = changes.map((c) => ({
    id: c.id,
    actorType: c.actorType,
    actorId: c.actorId,
    actorName: c.actorName,
    surface: c.surface,
    action: c.action,
    entityType: c.entityType,
    entityId: c.entityId,
    before: c.before,
    after: c.after,
    createdAt: c.createdAt.toISOString(),
    bulkGroup: c.bulkGroup,
  }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--sp-3)" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            color: "var(--accent-primary)",
            fontSize: "var(--fs-h3)",
            margin: 0,
          }}
        >
          Recent Changes
        </h1>
        <Link href="/admin/settings">
          <Button variant="ghost" size="sm">
            ← Settings
          </Button>
        </Link>
      </div>

      <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)", marginTop: "var(--sp-2)" }}>
        Every mutation across the admin -- including chat-driven changes once Phase 2 ships -- lands here with a
        one-click revert. Bulk operations revert as a whole batch.
      </p>

      <div style={{ marginTop: "var(--sp-5)" }}>
        <ChangesFeed changes={changeDtos} actors={actors} entityTypes={[...ENTITY_TYPES]} />
      </div>
    </div>
  );
}
