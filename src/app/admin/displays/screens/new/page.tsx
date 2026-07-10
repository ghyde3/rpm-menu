import Link from "next/link";
import { Button, Card } from "@/components/ds";
import { getCurrentSession } from "@/lib/auth/session";
import { ScreenForm } from "../ScreenForm";

export default async function NewScreenPage() {
  const session = await getCurrentSession();
  const isOwner = session?.user.role === "owner";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            color: "var(--accent-primary)",
            fontSize: "var(--fs-h3)",
            margin: 0,
          }}
        >
          New Screen
        </h1>
        <Link href="/admin/displays/screens">
          <Button variant="ghost" size="sm">
            ← Screens
          </Button>
        </Link>
      </div>

      <div style={{ marginTop: "var(--sp-5)" }}>
        {isOwner ? (
          <ScreenForm />
        ) : (
          <Card>
            <p style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)", margin: 0 }}>
              Screens are managed by the owner (PRD §2). Ask an owner to create this screen.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
