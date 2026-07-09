// Shared pricing helpers (addendum §1's "fail-safe rule" + PRD §5.1's
// "prices always integer cents" note). This is the ONLY place that turns
// integer cents into a display string or resolves a modifier option's
// effective price — screens, the admin UI, the public menu, and the MCP/REST
// surfaces must all render through this module rather than reimplementing
// the ambiguous-pricing refusal locally.
import type { ModifierPricingMode } from "@/db/schema";

export interface FormatPriceOptions {
  /** Currency symbol, defaults to "$" (see venue_settings.currency_format). */
  symbol?: string;
  /** When false, whole-dollar amounts render without ".00" (e.g. "$5" not
   * "$5.00") — mirrors venue_settings.currency_format.showTrailingZeros. */
  showTrailingZeros?: boolean;
}

/**
 * Formats integer cents as a display string. Returns `null` for `null` /
 * `undefined` input — callers (MenuItem, PriceTag, etc.) must treat a null
 * return as "render no price", never coerce it to "$0.00" or "Free".
 */
export function formatPrice(
  cents: number | null | undefined,
  options: FormatPriceOptions = {},
): string | null {
  if (cents === null || cents === undefined) return null;
  if (!Number.isFinite(cents)) return null;

  const symbol = options.symbol ?? "$";
  const showTrailingZeros = options.showTrailingZeros ?? true;
  const dollars = cents / 100;

  if (!showTrailingZeros && Number.isInteger(dollars)) {
    return `${symbol}${dollars}`;
  }
  return `${symbol}${dollars.toFixed(2)}`;
}

export interface ResolveOptionPriceInput {
  pricingMode: ModifierPricingMode;
  priceDeltaCents: number | null | undefined;
  replacementPriceCents: number | null | undefined;
}

export interface ResolvedOptionPrice {
  /** Cents to display, or `null` when no price should render at all. */
  cents: number | null;
  /** How `cents` relates to the item's base price — `null` when there is
   * nothing safe to say (ambiguous, or a delta/replacement not yet entered). */
  kind: "included" | "delta" | "replacement" | null;
  /** True whenever the caller should show a "needs pricing confirmed" marker
   * instead of any number — either because `pricing_mode = 'ambiguous'`
   * (the hard fail-safe) or because a delta/replacement mode was set but its
   * price column is still NULL (partially resolved). */
  needsReview: boolean;
}

/**
 * Resolves a modifier option's effective price per the addendum's
 * disambiguated pricing semantics.
 *
 * **Hard fail-safe:** `pricing_mode = 'ambiguous'` ALWAYS returns
 * `{ cents: null, kind: null, needsReview: true }` — it never falls through
 * to price_delta_cents/replacement_price_cents, even if those columns
 * happen to be non-null (e.g. leftover data from a mode change). There is no
 * options flag to bypass this; resolving ambiguity requires an explicit
 * admin action (see `resolveModifierOptionPricing` in the modifiers service),
 * not a rendering-time override.
 */
export function resolveOptionPrice(input: ResolveOptionPriceInput): ResolvedOptionPrice {
  switch (input.pricingMode) {
    case "ambiguous":
      return { cents: null, kind: null, needsReview: true };
    case "included":
      return { cents: 0, kind: "included", needsReview: false };
    case "delta": {
      const cents = input.priceDeltaCents ?? null;
      return { cents, kind: cents === null ? null : "delta", needsReview: cents === null };
    }
    case "replacement": {
      const cents = input.replacementPriceCents ?? null;
      return { cents, kind: cents === null ? null : "replacement", needsReview: cents === null };
    }
    default: {
      // Exhaustiveness guard — an unrecognized mode is treated exactly like
      // 'ambiguous' rather than risking a wrong price ever rendering.
      const _exhaustive: never = input.pricingMode;
      void _exhaustive;
      return { cents: null, kind: null, needsReview: true };
    }
  }
}

/** Convenience wrapper: resolves + formats in one call. Returns `null`
 * whenever `resolveOptionPrice` sets `needsReview` — callers should pair a
 * `null` result with a "needs pricing confirmed" badge, not blank space that
 * looks unintentional. */
export function formatOptionPrice(
  input: ResolveOptionPriceInput,
  options?: FormatPriceOptions,
): string | null {
  const resolved = resolveOptionPrice(input);
  if (resolved.needsReview || resolved.cents === null) return null;
  return formatPrice(resolved.cents, options);
}
