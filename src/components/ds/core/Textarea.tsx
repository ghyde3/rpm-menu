"use client";

// Ported faithfully from RPM Pub Design System/components/core/Textarea.jsx
// (+ Textarea.d.ts contract). Multi-line dark field for descriptions.
import * as React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export function Textarea({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled = false,
  id,
  style,
  ...rest
}: TextareaProps) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || (label ? "ta-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", ...style }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "var(--ls-caps)",
            color: "var(--text-muted)",
          }}
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          background: "var(--surface-inset)",
          border: "var(--bw) solid " + (focus ? "var(--accent-primary)" : "var(--border-strong)"),
          borderRadius: "var(--radius-sm)",
          padding: "var(--sp-3)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--fs-body-sm)",
          lineHeight: "var(--lh-body)",
          resize: "vertical",
          outline: "none",
          transition: "border-color var(--dur) var(--ease)",
          opacity: disabled ? 0.5 : 1,
        }}
        {...rest}
      />
      {hint && (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--text-faint)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}
