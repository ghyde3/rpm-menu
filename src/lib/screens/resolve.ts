// Resolves a screen's *content* (which items, in what order, with what
// price/description/badges) exactly once, server-side, so the admin preview
// and the (future, displays-unit-owned) TV render route can share this
// single code path — "same route, same code" per PRD §3.2's preview
// requirement. Pure w.r.t. rendering (no React here); DB access only.
//
// All screen-level "show/hide" density knobs (`display_options.
// showDescriptions/showBadges/showAttributes`) and the unavailable-item
// treatment are resolved HERE, once, so the presentational template
// components (src/components/screens/templates/**) never need to reconsult
// `ScreenDisplayOptions` — they just render whatever fields this module
// already decided to include.
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  screens,
  screenItems,
  items,
  categories,
  itemTags,
  tags,
  itemPriceVariants,
  images,
  type Item,
  type Category,
  type Tag,
  type ItemPriceVariant,
  type ImageVariants,
} from "@/db/schema";
import type { DbClient } from "@/lib/service/base";
import { NotFoundError } from "@/lib/service/base/errors";
import type { Screen } from "@/lib/service/screens";
import { getItemDisplayLine } from "@/lib/menu/display-line";
import { formatPrice } from "@/lib/pricing";
import { getImage } from "@/lib/service/images";
import type { TagTone } from "@/components/ds";

export interface ResolvedScreenTag {
  label: string;
  tone: TagTone;
}

export interface ResolvedScreenItem {
  id: string;
  name: string;
  isAvailable: boolean;
  imageUrl: string | null;
  /** Already gated by the resolved `showDescriptions` knob — `null` means
   * "render nothing," never an empty string (mirrors pricing.ts's
   * null-means-omit convention). */
  description: string | null;
  /** Already gated by `showAttributes`; `null` means omit. */
  attributeLine: string | null;
  /** Formatted display price, or `null` for ask_server/tbd/no-price-set —
   * always produced via src/lib/pricing.ts's `formatPrice`, per the binding
   * "ALL price display goes through pricing.ts" rule. */
  price: string | null;
  /** Italic aside: "Ask your server", a happy-hour callout, or a joined size
   * variant list ("Full $16.63 · Half $14.55") — never more than one of
   * these at a time. */
  priceNote: string | null;
  /** Already gated by `showBadges` + `tag.visibility === "public"`. */
  tags: ResolvedScreenTag[];
}

export interface ResolvedScreen {
  screen: Screen;
  /** `display_options.title` if set, else the screen's own name. */
  title: string;
  items: ResolvedScreenItem[];
  backgroundImageUrl: string | null;
}

/** Known public-tag names get a matching `Tag` tone (§3.1's badge examples);
 * anything else — including gluten-free/non-alcoholic, a known design-system
 * gap flagged in docs/architecture.md — falls back to `tone="default"`
 * rather than inventing an off-token color. */
/** Prefers the "display" variant for the TV board (highest-res of the three
 * — the board is a large, space-constrained surface, unlike the public
 * menu's inline thumbnails), falling back to "card"/"thumb" if a
 * differently-processed image is missing a variant. Mirrors
 * src/lib/menu/public-query.ts's `pickImageUrl` (background image
 * resolution just above already uses this same display->card->thumb
 * preference order). */
function pickImageUrl(variants: ImageVariants | null | undefined): string | null {
  if (!variants) return null;
  return variants.display ?? variants.card ?? variants.thumb ?? Object.values(variants).find(Boolean) ?? null;
}

function toneForTagName(name: string): TagTone {
  const key = name.trim().toLowerCase();
  if (key === "new") return "new";
  if (key === "spicy") return "spicy";
  if (key === "vegan" || key === "vegetarian") return "veggie";
  if (key === "house-favorite" || key === "house favorite") return "fave";
  return "default";
}

function buildPriceInfo(
  item: Item,
  priceMode: "standard" | "happy_hour",
  variantsByItem: Map<string, ItemPriceVariant[]>,
): { price: string | null; priceNote: string | null } {
  if (item.pricingType === "ask_server") {
    return { price: null, priceNote: "Ask your server" };
  }
  if (item.pricingType === "tbd") {
    return { price: null, priceNote: null };
  }

  const variants = variantsByItem.get(item.id) ?? [];
  const happyHourVariant = variants.find((v) => v.kind === "happy_hour");

  if (priceMode === "happy_hour" && happyHourVariant) {
    return { price: formatPrice(happyHourVariant.priceCents), priceNote: "Happy Hour" };
  }

  const sizeVariants = variants.filter((v) => v.kind === "size").sort((a, b) => a.sortOrder - b.sortOrder);
  const priceNote =
    sizeVariants.length > 0
      ? sizeVariants.map((v) => `${v.label} ${formatPrice(v.priceCents) ?? ""}`.trim()).join(" · ")
      : null;

  return { price: formatPrice(item.priceCents), priceNote };
}

async function loadManualModeItems(db: DbClient, screenId: string): Promise<Item[]> {
  // Skip archived items even when a curated/manual screen still references
  // one via screen_items — archive removes the item from every render
  // surface, so a stale manual reference silently drops out (never errors).
  const rows = await db
    .select({ item: items })
    .from(screenItems)
    .innerJoin(items, eq(screenItems.itemId, items.id))
    .where(and(eq(screenItems.screenId, screenId), isNull(items.archivedAt)))
    .orderBy(screenItems.sortOrder);
  return rows.map((r) => r.item);
}

async function loadQueryModeItems(db: DbClient, screen: Screen): Promise<Item[]> {
  const cfg = screen.sourceConfig ?? {};
  const tagIds = cfg.tagIds ?? [];
  const categoryIds = cfg.categoryIds ?? [];
  if (tagIds.length === 0 && categoryIds.length === 0) return [];

  const merged = new Map<string, Item>();

  // Archived items (archived_at IS NOT NULL) are excluded from query-mode
  // screens too — a category/tag rule never surfaces an archived item.
  if (categoryIds.length > 0) {
    const byCategory = await db
      .select()
      .from(items)
      .where(and(inArray(items.categoryId, categoryIds), isNull(items.archivedAt)));
    for (const it of byCategory) merged.set(it.id, it);
  }
  if (tagIds.length > 0) {
    const byTag = await db
      .select({ item: items })
      .from(itemTags)
      .innerJoin(items, eq(itemTags.itemId, items.id))
      .where(and(inArray(itemTags.tagId, tagIds), isNull(items.archivedAt)));
    for (const row of byTag) merged.set(row.item.id, row.item);
  }

  const orderBy = cfg.orderBy ?? "sort_order";
  return Array.from(merged.values()).sort((a, b) => {
    if (orderBy === "name") return a.name.localeCompare(b.name);
    if (orderBy === "price") {
      const ap = a.priceCents ?? Number.MAX_SAFE_INTEGER;
      const bp = b.priceCents ?? Number.MAX_SAFE_INTEGER;
      return ap - bp || a.name.localeCompare(b.name);
    }
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  });
}

/**
 * Resolves everything a screen needs to render: matched items (query or
 * manual mode), the unavailable-item treatment, per-item display lines
 * (via the shared src/lib/menu/display-line.ts helper), public-tag badges,
 * and price (preferring the `kind = 'happy_hour'` price variant when
 * `display_options.price_mode = 'happy_hour'`, addendum §2).
 */
export async function resolveScreenContent(db: DbClient, screenId: string): Promise<ResolvedScreen> {
  const [screen] = await db.select().from(screens).where(eq(screens.id, screenId));
  if (!screen) throw new NotFoundError("screen", screenId);

  const options = screen.displayOptions ?? {};
  const unavailableTreatment = options.unavailableTreatment ?? "hide";
  const priceMode = options.priceMode ?? "standard";
  const showDescriptions = options.showDescriptions;
  const showBadges = options.showBadges;
  const showAttributes = options.showAttributes ?? true;

  let matchedItems =
    screen.sourceMode === "manual" ? await loadManualModeItems(db, screenId) : await loadQueryModeItems(db, screen);

  if (unavailableTreatment === "hide") {
    matchedItems = matchedItems.filter((i) => i.isAvailable);
  }

  const categoryIds = Array.from(new Set(matchedItems.map((i) => i.categoryId)));
  const categoryRows: Category[] = categoryIds.length
    ? await db.select().from(categories).where(inArray(categories.id, categoryIds))
    : [];
  const categoriesById = new Map(categoryRows.map((c) => [c.id, c]));

  const itemIds = matchedItems.map((i) => i.id);

  const tagRows: { itemId: string; tag: Tag }[] = itemIds.length
    ? await db
        .select({ itemId: itemTags.itemId, tag: tags })
        .from(itemTags)
        .innerJoin(tags, eq(itemTags.tagId, tags.id))
        .where(inArray(itemTags.itemId, itemIds))
    : [];
  const tagsByItem = new Map<string, Tag[]>();
  for (const row of tagRows) {
    const list = tagsByItem.get(row.itemId) ?? [];
    list.push(row.tag);
    tagsByItem.set(row.itemId, list);
  }

  // Ordered by id so "the" happy_hour variant (buildPriceInfo's
  // `.find(v => v.kind === "happy_hour")`) is deterministic even before a
  // race can be fully ruled out by the DB partial-unique index on
  // (item_id) WHERE kind = 'happy_hour' -- an unordered query previously
  // let two concurrently-inserted happy_hour rows "win" nondeterministically.
  const variantRows: ItemPriceVariant[] = itemIds.length
    ? await db
        .select()
        .from(itemPriceVariants)
        .where(inArray(itemPriceVariants.itemId, itemIds))
        .orderBy(itemPriceVariants.id)
    : [];
  const variantsByItem = new Map<string, ItemPriceVariant[]>();
  for (const v of variantRows) {
    const list = variantsByItem.get(v.itemId) ?? [];
    list.push(v);
    variantsByItem.set(v.itemId, list);
  }

  // Hero image only (§3.2 TV templates are space-constrained; the
  // multi-photo gallery is a public-menu-only concept, per the addendum —
  // `items.image_id` is kept in sync with whichever gallery row is primary
  // by src/lib/service/item-images.ts, so reading it here is exactly as
  // fresh as reading the gallery itself). One batch query, no N+1.
  const heroImageIds = Array.from(
    new Set(matchedItems.map((i) => i.imageId).filter((id): id is string => id != null)),
  );
  const heroImageRows = heroImageIds.length
    ? await db.select().from(images).where(inArray(images.id, heroImageIds))
    : [];
  const heroImageUrlById = new Map(heroImageRows.map((img) => [img.id, pickImageUrl(img.variants)]));

  let backgroundImageUrl: string | null = null;
  if (screen.backgroundImageKey) {
    try {
      const image = await getImage(db, screen.backgroundImageKey);
      backgroundImageUrl = image.variants.display ?? image.variants.card ?? image.variants.thumb ?? null;
    } catch {
      // backgroundImageKey pointing at a deleted/invalid image — render with
      // no background rather than throwing (never break a screen over a
      // stale decorative reference).
      backgroundImageUrl = null;
    }
  }

  const resolvedItems: ResolvedScreenItem[] = matchedItems.map((item) => {
    const category = categoriesById.get(item.categoryId);
    const line = category
      ? getItemDisplayLine(item, category, "display")
      : { attributeLine: null, description: null, showBadges: true, showDescription: false, attributeSegments: [] };

    const effectiveShowDescription = showDescriptions ?? line.showDescription;
    const effectiveShowBadges = showBadges ?? line.showBadges;

    const itemTagRows = (tagsByItem.get(item.id) ?? []).filter((t) => t.visibility === "public");
    const { price, priceNote } = buildPriceInfo(item, priceMode, variantsByItem);

    return {
      id: item.id,
      name: item.name,
      isAvailable: item.isAvailable,
      imageUrl: item.imageId ? heroImageUrlById.get(item.imageId) ?? null : null,
      description: effectiveShowDescription ? line.description : null,
      attributeLine: showAttributes ? line.attributeLine : null,
      price,
      priceNote,
      tags: effectiveShowBadges ? itemTagRows.map((t) => ({ label: t.name, tone: toneForTagName(t.name) })) : [],
    };
  });

  return {
    screen,
    title: options.title ?? screen.name,
    items: resolvedItems,
    backgroundImageUrl,
  };
}
