// Runtime parser for /rpm-menu-extracted.md. Turns the markdown text into
// structured sections/items with NO hand-transcribed prices/descriptions —
// every price, name, and description string below is extracted from the
// actual file content via regex/string ops, not retyped by hand.
//
// Menu-specific *interpretation* (which sentence means "this is a size
// variant" vs "this is a substitution upcharge") necessarily lives in code
// (see scripts/seed/import-menu.ts) because the source is prose, not
// structured data — but the underlying numbers/labels are always pulled out
// of the parsed text at runtime, never copied into a data literal.
import { readFileSync } from "node:fs";

export interface ParsedFoodItem {
  name: string;
  /** Cents parsed from the first `$amount` on the item's header line, or
   * null if the header carried no price (e.g. "Dessert of the Day"). */
  priceCents: number | null;
  /** Full joined description text (all body lines under the item header,
   * including any trailing "Half $14.55."-style sentences) — kept verbatim
   * so nothing is lost; structured extraction happens downstream. */
  description: string | null;
  /** Extra `label / $price` pairs found on the header line itself, beyond
   * the first (e.g. Hot Bavarian Pretzels: "Two / $11.43 · One / $8.32" ->
   * [{label:"One", priceCents:832}]). Empty for ordinary single-price items. */
  headerPriceVariants: { label: string; priceCents: number }[];
}

export interface ParsedFoodSection {
  name: string;
  tagline: string | null;
  /** Section-wide "- " bullet lines directly under the `## ` header, before
   * any `### ` item (e.g. Burgers' "Sub any burger for our veggie patty
   * $2.08"). */
  bullets: string[];
  items: ParsedFoodItem[];
  /** Plain paragraph text for sections with no `### ` items at all (Sides,
   * Pepsi Products, Notes) — e.g. Sides' single comma-separated line. */
  paragraphs: string[];
}

const DOLLAR_RE = /\$(\d+(?:\.\d{1,2})?)/;
const LABEL_SLASH_PRICE_RE = /([A-Za-z][A-Za-z ]*?)\s*\/\s*\$(\d+(?:\.\d{1,2})?)/g;

export function toCents(priceText: string): number {
  return Math.round(parseFloat(priceText) * 100);
}

function parseItemHeader(headerText: string): ParsedFoodItem {
  const m = headerText.match(/^(.*?)\s*—\s*(.+)$/);
  if (!m) {
    return { name: headerText.trim(), priceCents: null, description: null, headerPriceVariants: [] };
  }
  const name = m[1].trim();
  const priceSegment = m[2].trim();

  const pairs = [...priceSegment.matchAll(LABEL_SLASH_PRICE_RE)].map((mm) => ({
    label: mm[1].trim(),
    priceCents: toCents(mm[2]),
  }));

  if (pairs.length > 0) {
    // Multi-variant header (e.g. "Two / $11.43 · One / $8.32") — first pair
    // is the base/default price, the rest become size variants.
    return {
      name,
      priceCents: pairs[0].priceCents,
      description: null,
      headerPriceVariants: pairs.slice(1),
    };
  }

  const priceMatch = priceSegment.match(DOLLAR_RE);
  return {
    name,
    priceCents: priceMatch ? toCents(priceMatch[1]) : null,
    description: null,
    headerPriceVariants: [],
  };
}

export function parseFoodMenu(filePath: string): ParsedFoodSection[] {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n");

  const sections: ParsedFoodSection[] = [];
  let current: ParsedFoodSection | null = null;
  let currentItem: ParsedFoodItem | null = null;
  let descBuffer: string[] = [];

  const flushItem = () => {
    if (currentItem && current) {
      currentItem.description = descBuffer.length > 0 ? descBuffer.join("\n") : null;
      current.items.push(currentItem);
    }
    currentItem = null;
    descBuffer = [];
  };

  const flushSection = () => {
    flushItem();
    if (current) sections.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith("## ")) {
      flushSection();
      const headerText = line.slice(3).trim();
      const starIdx = headerText.indexOf("★"); // ★
      const name = starIdx >= 0 ? headerText.slice(0, starIdx).trim() : headerText;
      const tagline = starIdx >= 0 ? headerText.slice(starIdx).trim() : null;
      current = { name, tagline, bullets: [], items: [], paragraphs: [] };
      continue;
    }

    if (!current) continue; // front-matter/title before the first "## " section

    if (line.startsWith("### ")) {
      flushItem();
      currentItem = parseItemHeader(line.slice(4).trim());
      continue;
    }

    if (line === "" || line === "---") continue;
    if (line.startsWith(">")) continue; // blockquote intro
    if (line.startsWith("#")) continue; // stray heading level, ignore

    if (line.startsWith("- ")) {
      if (currentItem) {
        descBuffer.push(line.slice(2).trim());
      } else {
        current.bullets.push(line.slice(2).trim());
      }
      continue;
    }

    // Plain paragraph text.
    if (currentItem) {
      descBuffer.push(line);
    } else {
      current.paragraphs.push(line);
    }
  }
  flushSection();

  return sections;
}
