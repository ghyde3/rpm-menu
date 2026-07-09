import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

/** Multi-line dark field for menu item descriptions. */
export function Textarea(props: TextareaProps): JSX.Element;
