// Scaffold-only placeholder for admin nav sections not yet built by their
// owning feature unit. Each page.tsx that renders this will be replaced
// wholesale once that unit lands — this component just keeps the shell
// non-empty and on-brand in the meantime.
import { Card } from "@/components/ds";

export function PlaceholderSection({ title }: { title: string }) {
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
        {title}
      </h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <Card>
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            {`${title} isn't built yet — this section is pre-registered in the admin nav so the feature that owns it never needs to touch the shared shell.`}
          </p>
        </Card>
      </div>
    </div>
  );
}
