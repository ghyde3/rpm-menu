import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. primary = hot-rod red fill; secondary = outline; ghost = text; danger = red outline. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

/**
 * Chunky, flat bar-signage button. Uppercase Oswald, hard corners, hot-rod red.
 * @startingPoint section="Core" subtitle="Primary / outline / ghost actions" viewport="700x180"
 */
export function Button(props: ButtonProps): JSX.Element;
