// Runtime parser for /rpm-drinks-extracted.md. Same "extract, don't
// transcribe" contract as parse-food.ts: bullet lists and the markdown table
// are parsed generically; nothing here hand-types a name or a price.
import { readFileSync } from "node:fs";
import { toCents } from "./parse-food";

export interface ParsedDrinkItem {
  name: string;
  priceCents: number;
  description: string | null;
}

export interface ParsedDraftBeer {
  name: string;
  abv: number;
  style: string;
  priceCents: number;
}

export interface ParsedDrinksMenu {
  bottles: ParsedDrinkItem[];
  cans: ParsedDrinkItem[];
  drinkOfTheWeek: ParsedDrinkItem[];
  draftBeer: ParsedDraftBeer[];
}

const BULLET_ITEM_RE = /^\*\s*(.+?)\s*—\s*\$(\d+(?:\.\d{1,2})?)\s*$/;
const BOLD_ITEM_RE = /^\*\*(.+?)\*\*\s*—\s*\$(\d+(?:\.\d{1,2})?)\s*$/;

function parseBulletSection(lines: string[]): ParsedDrinkItem[] {
  const out: ParsedDrinkItem[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(BULLET_ITEM_RE);
    if (m) out.push({ name: m[1].trim(), priceCents: toCents(m[2]), description: null });
  }
  return out;
}

function parseDrinkOfTheWeekSection(lines: string[]): ParsedDrinkItem[] {
  const out: ParsedDrinkItem[] = [];
  let current: ParsedDrinkItem | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") continue;
    const m = line.match(BOLD_ITEM_RE);
    if (m) {
      if (current) out.push(current);
      current = { name: m[1].trim(), priceCents: toCents(m[2]), description: null };
      continue;
    }
    if (current) {
      current.description = current.description ? `${current.description}\n${line}` : line;
    }
  }
  if (current) out.push(current);
  return out;
}

const TABLE_ROW_RE = /^\|(.+)\|$/;

function parseDraftBeerTable(lines: string[]): ParsedDraftBeer[] {
  const out: ParsedDraftBeer[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const rowMatch = line.match(TABLE_ROW_RE);
    if (!rowMatch) continue;
    const cells = rowMatch[1].split("|").map((c) => c.trim());
    if (cells.length < 4) continue;
    // Skip header row and the markdown separator row (---/: only).
    if (/^:?-+:?$/.test(cells[0])) continue;
    if (cells[0].toLowerCase() === "drink") continue;

    const [nameCell, abvCell, styleCell, priceCell] = cells;
    const abvMatch = abvCell.match(/([\d.]+)\s*%/);
    const priceMatch = priceCell.match(/\$(\d+(?:\.\d{1,2})?)/);
    if (!abvMatch || !priceMatch) continue;

    out.push({
      name: nameCell.trim(),
      abv: parseFloat(abvMatch[1]),
      style: styleCell.trim(),
      priceCents: toCents(priceMatch[1]),
    });
  }
  return out;
}

export function parseDrinksMenu(filePath: string): ParsedDrinksMenu {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n");

  const sectionLines = new Map<string, string[]>();
  let currentSection: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      currentSection = line.slice(3).trim();
      sectionLines.set(currentSection, []);
      continue;
    }
    if (!currentSection) continue;
    sectionLines.get(currentSection)!.push(line);
  }

  return {
    bottles: parseBulletSection(sectionLines.get("Bottles") ?? []),
    cans: parseBulletSection(sectionLines.get("Cans") ?? []),
    drinkOfTheWeek: parseDrinkOfTheWeekSection(sectionLines.get("Drink of the Week") ?? []),
    draftBeer: parseDraftBeerTable(sectionLines.get("Draft Beer") ?? []),
  };
}
