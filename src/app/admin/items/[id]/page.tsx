// Item detail/edit: core fields (ItemForm), tag assignment, price variants
// (sizes), availability, and a link out to Modifiers (owned by the
// modifiers unit — src/app/admin/items/[id]/modifiers/**, not this one).
import { notFound } from "next/navigation";
import Link from "next/link";
import { getItem, getItemTagIds, listItemPriceVariants } from "@/lib/service/items";
import { listCategories } from "@/lib/service/categories";
import { listTags } from "@/lib/service/tags";
import { NotFoundError } from "@/lib/service/base/errors";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { Button, Card } from "@/components/ds";
import { ItemForm } from "../ItemForm";
import { TagAssignment } from "./TagAssignment";
import { PriceVariantsEditor } from "./PriceVariantsEditor";
import { DeleteItemButton } from "./DeleteItemButton";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentSession();
  const isOwner = session?.user.role === "owner";

  const item = await getItem(db, id).catch((err) => {
    if (err instanceof NotFoundError) return null;
    throw err;
  });
  if (!item) notFound();

  const [categories, tags, currentTagIds, priceVariants] = await Promise.all([
    listCategories(db),
    listTags(db),
    getItemTagIds(db, id),
    listItemPriceVariants(db, id),
  ]);

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
          {item.name}
        </h1>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <Link href={`/admin/items/${item.id}/modifiers`}>
            <Button variant="secondary" size="sm">
              Modifiers
            </Button>
          </Link>
          <Link href="/admin/items">
            <Button variant="ghost" size="sm">
              ← Items
            </Button>
          </Link>
        </div>
      </div>

      <div style={{ marginTop: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
        <ItemForm categories={categories} isOwner={isOwner} item={item} />

        <Card>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "0.875rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "var(--ls-caps)",
              color: "var(--text-muted)",
              marginBottom: "var(--sp-3)",
            }}
          >
            Tags
          </h2>
          <TagAssignment itemId={item.id} allTags={tags} initialTagIds={currentTagIds} />
        </Card>

        <Card>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "0.875rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "var(--ls-caps)",
              color: "var(--text-muted)",
              marginBottom: "var(--sp-3)",
            }}
          >
            Price Variants
          </h2>
          <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", marginTop: 0 }}>
            e.g. pint/pitcher, cup/bowl, full/half. Owner only.
          </p>
          <PriceVariantsEditor itemId={item.id} initialVariants={priceVariants} isOwner={isOwner} />
        </Card>

        {isOwner && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <DeleteItemButton itemId={item.id} itemName={item.name} />
          </div>
        )}
      </div>
    </div>
  );
}
