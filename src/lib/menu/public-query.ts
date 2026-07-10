// Public web menu read-model (PRD §3.4 + addendum). Aggregates
// venue_settings (name/branding/menu-behavior), categories, items, public
// tags, and `size`-kind price variants into the single shape
// src/app/menu/page.tsx renders. Read-only — no ServiceCaller/audit; the
// public menu route has no auth and mutates nothing (§3.6). Revalidation of
// the page this feeds is driven entirely by `bumpAffectedScreens`'
// `revalidatePath("/menu")` (src/lib/service/base/bump-affected-screens.ts)
// on every admin mutation — this module never touches Next.js cache APIs
// itself, so it stays framework-agnostic and trivially testable with plain
// `createTestDb()` instances.
//
// Hard rules this module enforces (do not weaken without re-reading the
// PRD/addendum):
//   - Private tags NEVER appear in the returned data (§3.4) — only
//     `tags.visibility === 'public'` rows are included, and only when both
//     the venue's `showPublicTagBadges` toggle and the item's category
//     `display_config.showBadges` (src/lib/menu/display-line.ts) are true.
//   - `pricing_type = 'tbd'` items get no price and no substitute text
//     (task spec: "tbd items render without price"). `ask_server` items
//     render the literal note "Ask your server" instead of a number.
//   - Price variants: only `kind = 'size'` variants are surfaced here.
//     `kind = 'happy_hour'` variants are a screens-unit concern
//     (`display_options.price_mode`), never the public menu.
//   - All price math flows through src/lib/pricing.ts's `formatPrice` —
//     this file never hand-formats cents.
import { eq, inArray, isNull } from "drizzle-orm";
import {
  categories,
  images,
  itemPriceVariants,
  items,
  itemTags,
  tags,
  type Category,
  type CategoryType,
  type Item,
  type ItemPriceVariant,
  type ImageVariants,
} from "@/db/schema";
import type { DbClient } from "@/lib/service/base";
import { getVenueSettings } from "@/lib/service/settings/venue";
import { getBrandingSettings, BRANDING_FONT_STACKS, type BrandingFont } from "@/lib/service/settings/branding";
import { getMenuBehaviorSettings } from "@/lib/service/settings/menu-behavior";
import { listItemImagesForItems, type ItemImageGalleryEntry } from "@/lib/service/item-images";
import { formatPrice } from "@/lib/pricing";
import { getItemDisplayLine, resolveDisplayConfig } from "@/lib/menu/display-line";
import type { TagTone } from "@/components/ds";

// --- Tag presentation -------------------------------------------------------

/** Design-system `Tag` has no gluten-free/non-alcoholic tone (documented gap
 * — see docs/architecture.md's "Design system integration" + addendum §3).
 * Maps the PRD §3.1 seed public tags to the closest tone, falling back to
 * "default" for anything else rather than inventing an off-token color. */
export function tagTone(tagName: string): TagTone {
  switch (tagName.toLowerCase()) {
    case "spicy":
      return "spicy";
    case "vegan":
    case "vegetarian":
      return "veggie";
    case "new":
      return "new";
    case "house-favorite":
      return "fave";
    default:
      return "default";
  }
}

/** schema.org `Restricted Diet` mapping, best-effort SEO enrichment for the
 * three seed tags that have a direct schema.org counterpart. Silently
 * omitted (no `dietUrl`) for every other tag rather than guessing. */
const DIET_URL_BY_TAG: Record<string, string> = {
  vegan: "https://schema.org/VeganDiet",
  vegetarian: "https://schema.org/VegetarianDiet",
  "gluten-free": "https://schema.org/GlutenFreeDiet",
};

export interface PublicMenuTag {
  label: string;
  tone: TagTone;
  dietUrl?: string;
}

// --- Result shape ------------------------------------------------------------

/** One additional (non-hero) gallery photo, sized for a small thumbnail
 * strip (`thumbUrl`) with a full-size `url` to promote into the hero slot
 * when a visitor picks it (src/app/menu/ItemGallery.tsx), plus the largest
 * `displayUrl` (~1920w) variant the full-screen lightbox opens. */
export interface PublicMenuGalleryPhoto {
  url: string;
  thumbUrl: string;
  displayUrl: string;
}

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  /** Ordered typed-attribute segments joined per category display_config,
   * e.g. "5.2% ABV · IBU 38" (src/lib/menu/display-line.ts). */
  attributeLine: string | null;
  /** Dollars (e.g. `12.99`), ready for `MenuItemProps.price`. `undefined`
   * means "render no price at all" — covers `pricing_type` `ask_server`/
   * `tbd`, and the data-anomaly case of `pricing_type = 'fixed'` with a
   * null `price_cents`. */
  price: number | undefined;
  /** Italic aside per `MenuItemProps.note` — the literal "Ask your server"
   * for `pricing_type = 'ask_server'`, or the item's other `size` price
   * variants (e.g. "Half 8.29") when it has any, joined with " · ". Prices
   * inside this note deliberately carry no currency symbol, matching the
   * design system's "no leading $ on the board" rule. */
  note: string | undefined;
  isAvailable: boolean;
  imageUrl: string | null;
  /** Largest (~1920w) variant of the hero photo, opened by the full-screen
   * lightbox (src/app/menu/ImageLightbox.tsx). `null` whenever `imageUrl`
   * is — both are `showImages`-gated together. */
  imageDisplayUrl: string | null;
  /** Additional (non-primary) gallery photos, ordered per the admin's
   * chosen sort order, `[]` when the item has zero or one photo total
   * (matches `imageUrl` — both are `showImages`-gated and both empty for
   * an item with no gallery, so no-photo items render identically to
   * before this field existed). */
  gallery: PublicMenuGalleryPhoto[];
  tags: PublicMenuTag[];
  featuredSlotKey: string | null;
  /** Human-readable form of `featuredSlotKey` (e.g. "Drink Of The Week"),
   * or `null` when the item doesn't hold a featured slot. */
  featuredLabel: string | null;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  type: CategoryType;
  tagline: string | null;
  imageUrl: string | null;
  items: PublicMenuItem[];
}

export interface PublicMenuVenue {
  name: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  social: Record<string, string | undefined>;
  hours: Record<string, { open?: string; close?: string; closed?: boolean } | undefined>;
  /** CSS custom-property overrides derived from Settings > Branding (§3.8):
   * `--accent-primary`/`--accent-secondary` when an owner has set a brand
   * color, `--font-display` when a curated font has been chosen. Callers
   * spread this into a wrapping element's inline `style` so every
   * `@/components/ds` primitive picks up the override for free (they all
   * consume the token, never a hardcoded color). Empty object when no
   * branding overrides have been set (design-system defaults apply as-is). */
  cssVars: Record<string, string>;
}

export interface PublicMenuSeo {
  title: string;
  description: string | null;
}

export interface PublicMenuData {
  venue: PublicMenuVenue;
  seo: PublicMenuSeo;
  categories: PublicMenuCategory[];
}

// --- Helpers -----------------------------------------------------------------

function pickImageUrl(variants: ImageVariants | null | undefined): string | null {
  if (!variants) return null;
  return variants.card ?? variants.display ?? variants.thumb ?? Object.values(variants).find(Boolean) ?? null;
}

/** Smaller variant preference for the gallery's thumbnail strip (the
 * additional, non-hero photos) — opposite priority from `pickImageUrl`,
 * which favors the larger "card" variant for the hero image. */
function pickThumbUrl(variants: ImageVariants | null | undefined): string | null {
  if (!variants) return null;
  return variants.thumb ?? variants.card ?? variants.display ?? Object.values(variants).find(Boolean) ?? null;
}

/** Largest available variant, preferred for the full-screen lightbox
 * (src/app/menu/ImageLightbox.tsx) — `display` (~1920w) first, falling
 * back down the ladder for older images processed before it existed. */
function pickDisplayUrl(variants: ImageVariants | null | undefined): string | null {
  if (!variants) return null;
  return variants.display ?? variants.card ?? variants.thumb ?? Object.values(variants).find(Boolean) ?? null;
}

function resolveImageUrl(imageId: string | null, urlById: Map<string, string | null>): string | null {
  if (!imageId) return null;
  return urlById.get(imageId) ?? null;
}

function humanizeFeaturedSlot(key: string | null): string | null {
  if (!key) return null;
  return key
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/** Resolves an item's public-facing price + note per pricing_type, applying
 * the addendum's unpriced-item rules (task spec: ask_server -> "Ask your
 * server" note with no price; tbd -> no price and no note). `fixed` items
 * with `size` price variants get the other sizes listed in `note`, mirroring
 * MenuItemProps' own doc-comment example ("half 12.99"). */
function resolveItemPricing(
  item: Pick<Item, "pricingType" | "priceCents">,
  sizeVariants: ItemPriceVariant[],
  showTrailingZeros: boolean,
): { price: number | undefined; note: string | undefined } {
  if (item.pricingType === "ask_server") {
    return { price: undefined, note: "Ask your server" };
  }
  if (item.pricingType === "tbd") {
    return { price: undefined, note: undefined };
  }

  const price = item.priceCents != null ? item.priceCents / 100 : undefined;
  const note =
    sizeVariants.length > 0
      ? sizeVariants
          .map((v) => `${v.label} ${formatPrice(v.priceCents, { symbol: "", showTrailingZeros })}`)
          .join(" · ")
      : undefined;
  return { price, note };
}

// --- Query ---------------------------------------------------------------

/**
 * Builds the complete public-menu read model in a handful of bulk queries
 * (no N+1 — data volume is trivial at this scale per the addendum). Callers
 * (src/app/menu/page.tsx) render this directly; nothing here depends on
 * Next.js.
 */
export async function getPublicMenu(db: DbClient): Promise<PublicMenuData> {
  // Sequential, not Promise.all: each of these lazily creates the
  // venue_settings singleton row on first read if it doesn't exist yet
  // (see each module's getOrCreateVenueSettingsRow) — running them
  // concurrently races three inserts against the same fixed-id primary key.
  const venue = await getVenueSettings(db);
  const branding = await getBrandingSettings(db);
  const menuBehavior = await getMenuBehaviorSettings(db);

  const { showImages, showPublicTagBadges, unavailableTreatment, seoTitle, seoDescription } = menuBehavior;
  const showTrailingZeros = venue.currencyFormat?.showTrailingZeros?.web ?? true;

  const categoryRows = await db.select().from(categories).orderBy(categories.sortOrder, categories.name);
  // Archived items (archived_at IS NOT NULL) never appear on the public menu,
  // regardless of the unavailable-treatment setting — archive is a hard
  // removal from every customer surface, distinct from the 86'd/unavailable
  // state which the badge treatment still shows.
  const itemRows = await db
    .select()
    .from(items)
    .where(isNull(items.archivedAt))
    .orderBy(items.sortOrder, items.name);
  const itemIds = itemRows.map((i) => i.id);

  const itemTagRows = itemIds.length
    ? await db
        .select({ itemId: itemTags.itemId, tag: tags })
        .from(itemTags)
        .innerJoin(tags, eq(itemTags.tagId, tags.id))
        .where(inArray(itemTags.itemId, itemIds))
    : [];

  const variantRows = itemIds.length
    ? await db
        .select()
        .from(itemPriceVariants)
        .where(inArray(itemPriceVariants.itemId, itemIds))
        .orderBy(itemPriceVariants.sortOrder)
    : [];

  const referencedImageIds = Array.from(
    new Set(
      [venue.logoImageId, ...categoryRows.map((c) => c.imageId), ...itemRows.map((i) => i.imageId)].filter(
        (id): id is string => id != null,
      ),
    ),
  );
  const imageRows = referencedImageIds.length
    ? await db.select().from(images).where(inArray(images.id, referencedImageIds))
    : [];
  const imageUrlById = new Map(imageRows.map((img) => [img.id, pickImageUrl(img.variants)]));
  const imageDisplayUrlById = new Map(imageRows.map((img) => [img.id, pickDisplayUrl(img.variants)]));

  // Batch, N+1-safe gallery read (src/lib/service/item-images.ts) — one
  // join query for every item's photos, keyed by itemId.
  const galleryByItem = await listItemImagesForItems(db, itemIds);

  const publicTagsByItem = new Map<string, PublicMenuTag[]>();
  for (const row of itemTagRows) {
    if (row.tag.visibility !== "public") continue; // §3.4 hard rule: private tags never render here.
    const list = publicTagsByItem.get(row.itemId) ?? [];
    list.push({
      label: row.tag.name,
      tone: tagTone(row.tag.name),
      dietUrl: DIET_URL_BY_TAG[row.tag.name.toLowerCase()],
    });
    publicTagsByItem.set(row.itemId, list);
  }

  const sizeVariantsByItem = new Map<string, ItemPriceVariant[]>();
  for (const variant of variantRows) {
    if (variant.kind !== "size") continue; // happy_hour variants are a screens-unit concern, not this page.
    const list = sizeVariantsByItem.get(variant.itemId) ?? [];
    list.push(variant);
    sizeVariantsByItem.set(variant.itemId, list);
  }

  const itemsByCategory = new Map<string, Item[]>();
  for (const item of itemRows) {
    const list = itemsByCategory.get(item.categoryId) ?? [];
    list.push(item);
    itemsByCategory.set(item.categoryId, list);
  }

  const menuCategories: PublicMenuCategory[] = categoryRows
    .map((category) => buildPublicCategory(category, itemsByCategory.get(category.id) ?? [], {
      showImages,
      showPublicTagBadges,
      unavailableTreatment,
      showTrailingZeros,
      imageUrlById,
      imageDisplayUrlById,
      publicTagsByItem,
      sizeVariantsByItem,
      galleryByItem,
    }))
    // A category with zero renderable items (none created yet, or all
    // hidden by the unavailable-item setting) contributes an empty section
    // — skip it rather than showing a bare header with nothing under it.
    .filter((category) => category.items.length > 0);

  const cssVars: Record<string, string> = {};
  if (branding.branding.primaryColor) cssVars["--accent-primary"] = branding.branding.primaryColor;
  if (branding.branding.accentColor) cssVars["--accent-secondary"] = branding.branding.accentColor;
  const brandFont = branding.branding.font;
  if (brandFont && brandFont in BRANDING_FONT_STACKS) {
    cssVars["--font-display"] = BRANDING_FONT_STACKS[brandFont as BrandingFont];
  }

  return {
    venue: {
      name: venue.name,
      logoUrl: showImages ? resolveImageUrl(branding.logoImageId, imageUrlById) : null,
      address: venue.address,
      phone: venue.phone,
      social: venue.social,
      hours: venue.hours,
      cssVars,
    },
    seo: {
      title: seoTitle ?? `${venue.name} Menu`,
      description: seoDescription,
    },
    categories: menuCategories,
  };
}

interface CategoryBuildContext {
  showImages: boolean;
  showPublicTagBadges: boolean;
  unavailableTreatment: "hide" | "badge";
  showTrailingZeros: boolean;
  imageUrlById: Map<string, string | null>;
  imageDisplayUrlById: Map<string, string | null>;
  publicTagsByItem: Map<string, PublicMenuTag[]>;
  sizeVariantsByItem: Map<string, ItemPriceVariant[]>;
  galleryByItem: Map<string, ItemImageGalleryEntry[]>;
}

/** Non-primary gallery entries, in sort order, mapped to the compact
 * {url, thumbUrl} shape the public menu's thumbnail strip needs. The
 * primary entry is deliberately excluded — it's already rendered as the
 * item's prominent hero image via `imageUrl` (item.imageId), so including
 * it again here would duplicate it in the strip. */
function buildGalleryPhotos(entries: ItemImageGalleryEntry[]): PublicMenuGalleryPhoto[] {
  return entries
    .filter((entry) => !entry.isPrimary)
    .map((entry) => ({
      url: pickImageUrl(entry.variants) ?? "",
      thumbUrl: pickThumbUrl(entry.variants) ?? "",
      displayUrl: pickDisplayUrl(entry.variants) ?? "",
    }))
    .filter((photo) => photo.url && photo.thumbUrl);
}

function buildPublicCategory(
  category: Category,
  rawItems: Item[],
  ctx: CategoryBuildContext,
): PublicMenuCategory {
  const display = resolveDisplayConfig(category);
  const renderedItems: PublicMenuItem[] = [];

  for (const item of rawItems) {
    if (!item.isAvailable && ctx.unavailableTreatment === "hide") continue;

    const line = getItemDisplayLine(item, category, "web");
    const { price, note } = resolveItemPricing(
      item,
      ctx.sizeVariantsByItem.get(item.id) ?? [],
      ctx.showTrailingZeros,
    );
    const tagsForItem =
      ctx.showPublicTagBadges && display.showBadges ? ctx.publicTagsByItem.get(item.id) ?? [] : [];

    renderedItems.push({
      id: item.id,
      name: item.name,
      description: line.description,
      attributeLine: line.attributeLine,
      price,
      note,
      isAvailable: item.isAvailable,
      imageUrl: ctx.showImages ? resolveImageUrl(item.imageId, ctx.imageUrlById) : null,
      imageDisplayUrl: ctx.showImages ? resolveImageUrl(item.imageId, ctx.imageDisplayUrlById) : null,
      gallery: ctx.showImages ? buildGalleryPhotos(ctx.galleryByItem.get(item.id) ?? []) : [],
      tags: tagsForItem,
      featuredSlotKey: item.featuredSlotKey,
      featuredLabel: humanizeFeaturedSlot(item.featuredSlotKey),
    });
  }

  return {
    id: category.id,
    name: category.name,
    type: category.type,
    tagline: category.tagline,
    imageUrl: ctx.showImages ? resolveImageUrl(category.imageId, ctx.imageUrlById) : null,
    items: renderedItems,
  };
}

// --- schema.org JSON-LD ------------------------------------------------------

/** Minimal schema.org `Menu` structure (§3.4's "SEO basics: proper headings,
 * schema.org Menu markup"). Pure data transform over `PublicMenuData` — no
 * DB access — so it's usable both from the page and from tests. */
export function buildMenuJsonLd(data: PublicMenuData, url: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: data.seo.title,
    ...(data.seo.description ? { description: data.seo.description } : {}),
    url,
    hasMenuSection: data.categories.map((category) => ({
      "@type": "MenuSection",
      name: category.name,
      ...(category.tagline ? { description: category.tagline } : {}),
      hasMenuItem: category.items.map((item) => {
        const dietUrls = item.tags.map((t) => t.dietUrl).filter((u): u is string => Boolean(u));
        return {
          "@type": "MenuItem",
          name: item.name,
          ...(item.description ? { description: item.description } : {}),
          ...(item.price !== undefined
            ? { offers: { "@type": "Offer", price: item.price.toFixed(2), priceCurrency: "USD" } }
            : {}),
          ...(dietUrls.length > 0 ? { suitableForDiet: dietUrls } : {}),
        };
      }),
    })),
  };
}

/** Serializes a JSON-LD object for safe embedding inside a `<script
 * type="application/ld+json">` tag. `JSON.stringify` alone does NOT escape
 * `<`, so a DB-sourced string (item name/description, category name/
 * tagline, owner-set SEO title/description -- all authored by staff/owner,
 * not trusted) containing the literal text `</script>` would prematurely
 * close the tag and let an attacker inject arbitrary executable HTML into
 * the fully public, unauthenticated `/menu` page. Escaping `<` (plus
 * U+2028/2029, which are valid in JSON strings but invalid in JS source and
 * can break some parsers/minifiers) neutralizes that without changing the
 * parsed JSON-LD value at all. Use this instead of a bare `JSON.stringify`
 * any time DB-sourced data is embedded in an inline <script> tag. */
export function safeJsonLdString(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
