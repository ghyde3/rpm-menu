// Plain data shared between the server-rendered item detail page
// (page.tsx) and the client-only FeaturedSlotPicker. Deliberately NOT in
// FeaturedSlotPicker.tsx: that module has a "use client" directive, and
// Next.js/Turbopack replaces every export of a client module with an
// opaque client-reference stub when it's imported from a Server Component
// -- calling .reduce() (or any array method) on that stub throws at
// request time. Keeping this data in a plain module with no "use client"
// lets both the server page and the client picker import the real array.
//
// The two named slots the addendum/PRD describe (drink_of_the_week,
// dessert_of_the_day). `featured_slot_key` is actually a free-text column
// -- the picker only *offers* these two plus "none", but keeps any other
// value an item already carries selectable rather than silently dropping
// it.
export const KNOWN_FEATURED_SLOTS: { key: string; label: string }[] = [
  { key: "drink_of_the_week", label: "Drink of the Week" },
  { key: "dessert_of_the_day", label: "Dessert of the Day" },
];

export interface FeaturedSlotHolder {
  id: string;
  name: string;
}
