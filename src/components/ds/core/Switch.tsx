"use client";

// Ported faithfully from RPM Pub Design System/components/core/Switch.jsx
// (+ Switch.d.ts contract). Availability toggle — green when on.
import * as React from "react";

export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Caps label to the right of the track. */
  label?: string;
  disabled?: boolean;
  id?: string;
  style?: React.CSSProperties;
}

export function Switch({ checked = false, onChange, label, disabled = false, id, style }: SwitchProps) {
  const inputId = id || (label ? "sw-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
  const w = 46;
  const h = 26;
  const pad = 3;
  const knob = h - pad * 2;
  return (
    <label
      htmlFor={inputId}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <span
        style={{
          position: "relative",
          width: w,
          height: h,
          flexShrink: 0,
          background: checked ? "var(--accent-new)" : "var(--surface-inset)",
          border: "var(--bw) solid " + (checked ? "var(--accent-new)" : "var(--border-strong)"),
          borderRadius: "var(--radius-pill)",
          transition: "background var(--dur) var(--ease), border-color var(--dur) var(--ease)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: pad - 2,
            left: checked ? w - knob - pad - 2 : pad - 2,
            width: knob,
            height: knob,
            borderRadius: "var(--radius-pill)",
            background: checked ? "#16240a" : "var(--rpm-steel)",
            transition: "left var(--dur) var(--ease), background var(--dur) var(--ease)",
          }}
        />
      </span>
      {label && (
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "var(--ls-caps)",
          }}
        >
          {label}
        </span>
      )}
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        readOnly={!onChange}
      />
    </label>
  );
}
