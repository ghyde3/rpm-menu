// Modifier Groups library + the addendum's "needs pricing review" dashboard
// nag (addendum §1: "a dashboard view lists all unresolved options... N
// substitution options need pricing confirmed... linking straight into the
// item's Modifiers section").
import Link from "next/link";
import { db } from "@/db";
import { Button, Card } from "@/components/ds";
import { listModifierGroupsWithSummary, listOptionsNeedingPricingReview } from "@/lib/service/modifiers";

const sectionHeading: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  fontSize: "0.9375rem",
  color: "var(--text-secondary)",
  margin: "0 0 var(--sp-3)",
};

export default async function ModifiersPage() {
  const [groups, pricingReview] = await Promise.all([
    listModifierGroupsWithSummary(db),
    listOptionsNeedingPricingReview(db),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
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
          Modifiers
        </h1>
        <Link href="/admin/modifiers/new">
          <Button size="sm">+ New Group</Button>
        </Link>
      </div>

      {pricingReview.length > 0 && (
        <Card accent style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <h2 style={{ ...sectionHeading, color: "var(--accent-primary)" }}>
            {pricingReview.length} option{pricingReview.length === 1 ? "" : "s"} {pricingReview.length === 1 ? "needs" : "need"} pricing confirmed
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {pricingReview.map(({ option, group, affectedItems }) => (
              <div
                key={option.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "var(--sp-3)",
                  padding: "var(--sp-2) 0",
                  borderBottom: "var(--bw) solid var(--border-hairline)",
                }}
              >
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", fontWeight: 600 }}>
                    {option.label}
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--text-faint)" }}>
                    {group.name}
                    {option.rawPriceText ? ` — source: "${option.rawPriceText}"` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
                  {affectedItems.length === 0 && (
                    <Link href={`/admin/modifiers/${group.id}`}>
                      <Button variant="secondary" size="sm">
                        Not attached — open group
                      </Button>
                    </Link>
                  )}
                  {affectedItems.slice(0, 4).map((item) => (
                    <Link key={item.id} href={`/admin/items/${item.id}/modifiers`}>
                      <Button variant="secondary" size="sm">
                        Resolve on {item.name}
                      </Button>
                    </Link>
                  ))}
                  {affectedItems.length > 4 && (
                    <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", alignSelf: "center" }}>
                      +{affectedItems.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <section>
        <h2 style={sectionHeading}>Modifier Groups ({groups.length})</h2>
        {groups.length === 0 ? (
          <Card>
            <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", margin: 0 }}>
              No modifier groups yet.{" "}
              <Link href="/admin/modifiers/new" style={{ color: "var(--accent-primary)" }}>
                Create your first group
              </Link>{" "}
              (add-ons, section defaults, required choices) then attach it to an item or a whole category.
            </p>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {groups
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
              .map((group) => (
                <Link key={group.id} href={`/admin/modifiers/${group.id}`} style={{ textDecoration: "none" }}>
                  <Card style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", padding: "var(--sp-3) var(--sp-4)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", fontWeight: 600 }}>
                        {group.name}
                        {group.isRequired && (
                          <span style={{ color: "var(--accent-primary)", marginLeft: "var(--sp-2)", fontSize: "0.75rem" }}>
                            REQUIRED
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--text-faint)" }}>
                        {group.selectionType === "single" ? "Pick one" : "Pick multiple"}
                        {group.maxSelect ? ` (max ${group.maxSelect})` : ""}
                        {" · "}
                        {group.optionCount} option{group.optionCount === 1 ? "" : "s"}
                        {" · "}
                        attached to {group.attachmentCount} target{group.attachmentCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </Card>
                </Link>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
