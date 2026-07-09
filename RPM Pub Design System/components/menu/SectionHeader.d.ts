import React from "react";

export interface SectionHeaderProps {
  children?: React.ReactNode;
  /** Header color — defaults to hot-rod red. Use flame orange for secondary sections. */
  color?: string;
  /** Flank the label with amber stars (echoes the printed board). */
  stars?: boolean;
  align?: "left" | "center" | "right";
  size?: "md" | "lg" | "xl";
  style?: React.CSSProperties;
}

/**
 * Big Anton caps board header (SANDWICHES, DESSERTS).
 * @startingPoint section="Menu" subtitle="Flame-colored board section header" viewport="700x140"
 */
export function SectionHeader(props: SectionHeaderProps): JSX.Element;
