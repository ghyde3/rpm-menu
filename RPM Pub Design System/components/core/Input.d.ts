import React from "react";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  /** Caps label rendered above the field. */
  label?: string;
  /** Faint helper line below the field. */
  hint?: string;
  /** Static leading token, e.g. "$" for price fields. */
  prefix?: React.ReactNode;
}

/** Dark inset text field; border lights hot-rod red on focus. */
export function Input(props: InputProps): JSX.Element;
