import Link from "next/link";
import { Button, Card } from "@/components/ds";

// Minimal home page. The public menu itself lives at /menu (owned by the
// public-menu unit, M2) — this route is just an entry point to the admin
// and a placeholder until that unit lands.
export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-5)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <span style={{ fontFamily: "var(--font-accent)", fontSize: 40, color: "var(--rpm-cream)" }}>
          <span style={{ color: "var(--accent-primary)" }}>R</span>PM
        </span>
        <p
          style={{
            fontFamily: "var(--font-heading)",
            textTransform: "uppercase",
            letterSpacing: "var(--ls-wide)",
            fontSize: 13,
            color: "var(--text-muted)",
            marginTop: "var(--sp-2)",
            marginBottom: "var(--sp-6)",
          }}
        >
          Menu CMS + TV Display Platform
        </p>
        <Card>
          <Link href="/admin">
            <Button fullWidth>Go to Admin</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
