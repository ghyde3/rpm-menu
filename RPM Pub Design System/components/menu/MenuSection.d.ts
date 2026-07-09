import React from "react";
import type { MenuItemProps } from "./MenuItem";

export interface MenuSectionProps {
  title: string;
  /** Header color; defaults to hot-rod red. */
  color?: string;
  stars?: boolean;
  /** Italic fine-print intro under the header. */
  intro?: string;
  /** Data-driven rows. Omit to pass MenuItem children directly. */
  items?: MenuItemProps[];
  children?: React.ReactNode;
  headerSize?: "md" | "lg" | "xl";
  priceSize?: "sm" | "md" | "lg" | "xl";
  style?: React.CSSProperties;
}

/**
 * A full board category: header + stacked MenuItems.
 * @startingPoint section="Menu" subtitle="Category header + item stack" viewport="760x520"
 */
export function MenuSection(props: MenuSectionProps): JSX.Element;
