// Small regex-extraction helpers shared by import-menu.ts. Every function
// here pulls a number/label out of *parsed source text* at call time — none
// of them embed a menu price or name as a literal.
import { toCents } from "./parse-food";

/** Runs `re` (must have exactly one capture group: the dollar amount, digits
 * only, e.g. "10.63") against `text` and returns cents, or null if no match. */
export function extractCents(text: string | null | undefined, re: RegExp): number | null {
  if (!text) return null;
  const m = text.match(re);
  if (!m) return null;
  return toCents(m[1]);
}

/** Splits a "Your choice of A, B, C, ... X, Y or Z." style sentence into an
 * ordered list of individual option labels. Handles the trailing "Y or Z"
 * (Oxford-comma-less) construction by normalizing it to a comma first. */
export function splitChoiceList(sentence: string): string[] {
  const normalized = sentence.replace(/,?\s+or\s+/, ", ");
  return normalized
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Title-cases a short menu-option label extracted from mid-sentence prose
 * (e.g. regex-captured "chicken" / "grilled steak" -> "Chicken" / "Grilled
 * Steak") so structured option labels read consistently regardless of the
 * capitalization of the sentence they were pulled from. */
export function titleCase(label: string): string {
  return label
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Extracts the sentence following a "Your choice of " (or similar) lead-in,
 * up to the next period, from a block of description text. */
export function extractLeadInSentence(text: string | null | undefined, leadInRe: RegExp): string | null {
  if (!text) return null;
  const m = text.match(leadInRe);
  return m ? m[1].trim() : null;
}
