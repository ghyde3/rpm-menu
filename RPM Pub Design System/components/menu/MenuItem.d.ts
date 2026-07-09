import React from "react";
import type { TagTone } from "./Tag";

export interface MenuItemTag {
  label: string;
  tone?: TagTone;
}

export interface MenuItemProps {
  name: string;
  description?: string;
  /** 12.99 / "12.99" / "12" — rendered with superscript cents. */
  price: number | string;
  /** Italic aside, e.g. "sub grilled salmon 15.99" or "half 12.99". */
  note?: string;
  /** Attribute chips — plain strings or {label, tone}. */
  tags?: (string | MenuItemTag)[];
  /** false dims the row and strikes the title ("86'd"). */
  available?: boolean;
  /** Dotted leader line between title and price. */
  leaders?: boolean;
  priceSize?: "sm" | "md" | "lg" | "xl";
  style?: React.CSSProperties;
}

/**
 * One menu board row: title, dotted leader, price, description, tags.
 * @startingPoint section="Menu" subtitle="Single menu row with leader + price" viewport="700x180"
 */
export function MenuItem(props: MenuItemProps): JSX.Element;
