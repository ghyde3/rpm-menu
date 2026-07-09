import React from "react";

export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Caps label to the right of the track. */
  label?: string;
  disabled?: boolean;
  id?: string;
  style?: React.CSSProperties;
}

/** Availability toggle — green when on. Use to 86 / re-enable a menu item. */
export function Switch(props: SwitchProps): JSX.Element;
