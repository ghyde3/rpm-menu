import React from "react";

export type TagTone = "default" | "new" | "spicy" | "veggie" | "fave";

export interface TagProps {
  children?: React.ReactNode;
  /** Color mapping: new=green fill, spicy=red fill, veggie=green outline, fave=amber outline. */
  tone?: TagTone;
  style?: React.CSSProperties;
}

/** Small caps attribute chip for menu items (NEW, SPICY, GF, FAN FAVE). */
export function Tag(props: TagProps): JSX.Element;
