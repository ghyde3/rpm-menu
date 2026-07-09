// Settings > Users (§3.8). Owned by the settings-venue-users unit.
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { listUsers } from "@/lib/service/users";
import { Card } from "@/components/ds";
import { UsersTable } from "./UsersTable";

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
        Settings · Users
      </h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <Card>
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            User management is owner-only (§3.8). Ask an owner to make changes here.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default async function UsersSettingsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "owner") {
    return <OwnerOnlyNotice />;
  }

  const users = await listUsers(db, {
    actor: { type: "user", id: session.user.id },
    surface: "admin_ui",
    role: session.user.role,
    isActive: session.user.isActive,
  });

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
        Settings · Users
      </h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <UsersTable initialUsers={users} currentUserId={session.user.id} />
      </div>
    </div>
  );
}
