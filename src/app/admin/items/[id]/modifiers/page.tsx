// Per-item Modifiers section (addendum §1) — owned by the modifiers unit.
// Linked from the item detail page's "Modifiers" button.
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { Button } from "@/components/ds";
import { getItem } from "@/lib/service/items";
import { NotFoundError } from "@/lib/service/base/errors";
import { getItemModifierView, listModifierGroupsWithSummary } from "@/lib/service/modifiers";
import { ItemModifiersPanel } from "./ItemModifiersPanel";

export default async function ItemModifiersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const item = await getItem(db, id).catch((err) => {
    if (err instanceof NotFoundError) return null;
    throw err;
  });
  if (!item) notFound();

  const [view, allGroups] = await Promise.all([getItemModifierView(db, id), listModifierGroupsWithSummary(db)]);

  const attachedGroupIds = new Set(view.groups.map((g) => g.group.id));
  const attachableGroups = allGroups
    .filter((g) => !attachedGroupIds.has(g.id))
    .map((g) => ({ id: g.id, name: g.name }));

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
          {item.name} — Modifiers
        </h1>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <Link href="/admin/modifiers">
            <Button variant="ghost" size="sm">
              Modifiers Library
            </Button>
          </Link>
          <Link href={`/admin/items/${item.id}`}>
            <Button variant="ghost" size="sm">
              ← {item.name}
            </Button>
          </Link>
        </div>
      </div>

      <ItemModifiersPanel itemId={item.id} view={view} attachableGroups={attachableGroups} />
    </div>
  );
}
