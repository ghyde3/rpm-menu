// Items admin — the primary screen (/admin redirects straight here). PRD
// §3.1 goal: the one-tap availability toggle "must never be more than two
// taps from opening the admin on a phone" — landing here already is tap
// zero, so the toggle itself (ItemsBrowser -> AvailabilityToggle) is the
// single tap.
import { listItems } from "@/lib/service/items";
import { listCategories } from "@/lib/service/categories";
import { listTags } from "@/lib/service/tags";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import Link from "next/link";
import { Button } from "@/components/ds";
import { HubTabs, ITEMS_HUB_TABS } from "@/components/nav/HubTabs";
import { ItemsBrowser } from "./ItemsBrowser";

export default async function ItemsPage() {
  const session = await getCurrentSession();
  // Fetch active + archived in one shot ("all"); ItemsBrowser segments them
  // client-side via its Active | Archived filter (default Active).
  const [items, categories, tags] = await Promise.all([
    listItems(db, { status: "all" }),
    listCategories(db),
    listTags(db),
  ]);
  const isOwner = session?.user.role === "owner";

  return (
    <div>
      <HubTabs tabs={ITEMS_HUB_TABS} />
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
          Items
        </h1>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <Link href="/admin/items/new">
            <Button size="sm">+ New Item</Button>
          </Link>
        </div>
      </div>

      <div style={{ marginTop: "var(--sp-5)" }}>
        <ItemsBrowser items={items} categories={categories} tags={tags} isOwner={isOwner} />
      </div>
    </div>
  );
}
