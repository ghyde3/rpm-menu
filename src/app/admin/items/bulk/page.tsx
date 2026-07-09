// Bulk Ops admin page (PRD §3.1 "Bulk operations (admin UI)" + §9 M3).
// Owned by the changes-bulk-ops-and-revert unit.
import Link from "next/link";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { listItems } from "@/lib/service/items";
import { listCategories } from "@/lib/service/categories";
import { listTags } from "@/lib/service/tags";
import { Button } from "@/components/ds";
import { BulkOpsBoard } from "./BulkOpsBoard";

export default async function BulkOpsPage() {
  const session = await getCurrentSession();
  const [items, categories, tags] = await Promise.all([listItems(db), listCategories(db), listTags(db)]);
  const isOwner = session?.user.role === "owner";

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
          Bulk Ops
        </h1>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <Link href="/admin/items">
            <Button variant="secondary" size="sm">
              Items
            </Button>
          </Link>
          <Link href="/admin/changes">
            <Button variant="secondary" size="sm">
              Recent Changes
            </Button>
          </Link>
        </div>
      </div>

      <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)", marginTop: "var(--sp-2)" }}>
        Select items, choose an operation, preview the change, then apply. Every preview expires after 15 minutes if
        left unapplied, and every apply shows up in{" "}
        <Link href="/admin/changes" style={{ color: "var(--accent-primary)" }}>
          Recent Changes
        </Link>{" "}
        with one-click revert for the whole batch.
      </p>

      <div style={{ marginTop: "var(--sp-5)" }}>
        <BulkOpsBoard items={items} categories={categories} tags={tags} isOwner={isOwner} />
      </div>
    </div>
  );
}
