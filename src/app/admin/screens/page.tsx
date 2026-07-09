// Screens admin — list + create entry point (PRD §3.2). Owner-only: §2
// "staff ... cannot ... manage screens" — staff can still view the list (and
// the live preview) for reference, but every mutating action is gated by
// `isOwner` here and enforced again in the service layer regardless.
import Link from "next/link";
import { listScreens } from "@/lib/service/screens";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { Button, Card } from "@/components/ds";

const templateLabel: Record<string, string> = {
  list: "List",
  grid: "Grid",
  spotlight: "Spotlight",
};

export default async function ScreensPage() {
  const session = await getCurrentSession();
  const isOwner = session?.user.role === "owner";
  const screens = await listScreens(db);
  const sorted = [...screens].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--sp-3)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            color: "var(--accent-primary)",
            fontSize: "var(--fs-h3)",
            margin: 0,
          }}
        >
          Screens
        </h1>
        {isOwner && (
          <Link href="/admin/screens/new">
            <Button size="sm">+ New Screen</Button>
          </Link>
        )}
      </div>

      <div style={{ marginTop: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        {sorted.length === 0 && (
          <Card>
            <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", margin: 0 }}>
              {isOwner ? (
                <>
                  No screens yet.{" "}
                  <Link href="/admin/screens/new" style={{ color: "var(--accent-primary)" }}>
                    Create your first screen
                  </Link>
                  .
                </>
              ) : (
                "No screens yet — ask an owner to create one."
              )}
            </p>
          </Card>
        )}

        {sorted.map((screen) => (
          <Link key={screen.id} href={`/admin/screens/${screen.id}`} style={{ textDecoration: "none" }}>
            <Card
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--sp-4)",
              }}
            >
              <div>
                <div style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", fontWeight: 600 }}>
                  {screen.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    color: "var(--text-faint)",
                    fontSize: "0.8125rem",
                    marginTop: 2,
                  }}
                >
                  {templateLabel[screen.template] ?? screen.template} · {screen.sourceMode} · v{screen.version}
                </div>
              </div>
              <Button variant="ghost" size="sm">
                {isOwner ? "Edit" : "View"}
              </Button>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
