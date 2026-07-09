import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  /** Adds a thick red left rule — use to flag the active / featured panel. */
  accent?: boolean;
  children?: React.ReactNode;
}

/** Matte raised panel with hairline border and hard corners. */
export function Card(props: CardProps): JSX.Element;
