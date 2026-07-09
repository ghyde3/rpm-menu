import Link from "next/link";
import { Button } from "@/components/ds";
import { NewGroupForm } from "./NewGroupForm";

export default function NewModifierGroupPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", maxWidth: 560 }}>
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
          New Modifier Group
        </h1>
        <Link href="/admin/modifiers">
          <Button variant="ghost" size="sm">
            ← Modifiers
          </Button>
        </Link>
      </div>
      <NewGroupForm />
    </div>
  );
}
