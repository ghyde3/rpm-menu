// Item detail/edit: core fields (ItemForm), tag assignment, price variants
// (sizes), availability, and a link out to Modifiers (owned by the
// modifiers unit — src/app/admin/items/[id]/modifiers/**, not this one).
import { notFound } from "next/navigation";
import Link from "next/link";
import { getItem, getItemTagIds, listItemPriceVariants, listItems } from "@/lib/service/items";
import { listCategories } from "@/lib/service/categories";
import { listTags } from "@/lib/service/tags";
import { listItemImages } from "@/lib/service/item-images";
import { NotFoundError } from "@/lib/service/base/errors";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { Button, Card } from "@/components/ds";
import { ItemForm } from "../ItemForm";
import { TagAssignment } from "./TagAssignment";
import { PriceVariantsEditor } from "./PriceVariantsEditor";
import { DeleteItemButton } from "./DeleteItemButton";
import { ArchiveItemButton } from "./ArchiveItemButton";
import { FeaturedSlotPicker } from "./FeaturedSlotPicker";
import { ItemGallery } from "./ItemGallery";
import { KNOWN_FEATURED_SLOTS, type FeaturedSlotHolder } from "./featured-slots";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentSession();
  const isOwner = session?.user.role === "owner";

  const item = await getItem(db, id).catch((err) => {
    if (err instanceof NotFoundError) return null;
    throw err;
  });
  if (!item) notFound();

  const [categories, tags, currentTagIds, priceVariants, allItems, gallery] = await Promise.all([
    listCategories(db),
    listTags(db),
    getItemTagIds(db, id),
    listItemPriceVariants(db, id),
    listItems(db),
    listItemImages(db, id),
  ]);

  // Current holder of each known featured slot (excluding this item itself)
  // so the picker can warn before a reassignment silently steals the slot.
  const featuredSlotHolders = KNOWN_FEATURED_SLOTS.reduce<Record<string, FeaturedSlotHolder | undefined>>(
    (acc, slot) => {
      const holder = allItems.find((i) => i.featuredSlotKey === slot.key && i.id !== item.id);
      if (holder) acc[slot.key] = { id: holder.id, name: holder.name };
      return acc;
    },
    {},
  );

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
            Photos
          </h2>
          <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", marginTop: 0 }}>
            The photo badged &ldquo;Hero&rdquo; is the one shown on menus and screens. Reorder with the arrows —
            the rest are just gallery order.
          </p>
          <ItemGallery itemId={item.id} initialGallery={gallery} />
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
            Featured Slot
          </h2>
          <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", marginTop: 0 }}>
            e.g. Drink of the Week, Dessert of the Day — exactly one item holds each slot at a time.
          </p>
          <FeaturedSlotPicker itemId={item.id} currentSlotKey={item.featuredSlotKey} holders={featuredSlotHolders} />
        </Card>

        {/* Lifecycle: Archive (reversible) vs Delete (permanent). Archive is
            staff-or-owner; permanent delete stays owner-only. */}
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
            {item.archivedAt ? "Archived" : "Remove from menu"}
          </h2>
          <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", marginTop: 0 }}>
            {item.archivedAt
              ? "This item is archived — hidden from the menu, screens, and the default items list, but the record is kept. Restore it to bring it back exactly as it was."
              : "Archive hides it from the menu but keeps the record — you can restore it later. Delete is permanent."}
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--sp-3)",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <ArchiveItemButton itemId={item.id} isArchived={item.archivedAt !== null} />
            {isOwner && !item.archivedAt && <DeleteItemButton itemId={item.id} itemName={item.name} />}
          </div>
        </Card>
      </div>
    </div>
  );
}
