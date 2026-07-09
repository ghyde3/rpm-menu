import React from "react";

export type PriceSize = "sm" | "md" | "lg" | "xl";

export interface PriceTagProps {
  /** 12.99, "12.99", or "12" — cents default to 99 and render as superscript. */
  price: number | string;
  /** sm=inline, md=menu row, lg=TV board, xl=hero feature. */
  size?: PriceSize;
  /** Override color; defaults to beer-amber. */
  color?: string;
  style?: React.CSSProperties;
}

/** Classic board price: big dollars + raised superscript cents (12⁹⁹). */
export function PriceTag(props: PriceTagProps): JSX.Element;
