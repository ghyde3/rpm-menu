import React from "react";

/**
 * RPM Input — dark inset text field with a chunky border that lights red on focus.
 * Pairs a caps Oswald label above the control. Use across the CMS.
 */
export function Input({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = "text",
  prefix,
  disabled = false,
  id,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || (label ? "in-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);

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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "var(--surface-inset)",
          border: "var(--bw) solid " + (focus ? "var(--accent-primary)" : "var(--border-strong)"),
          borderRadius: "var(--radius-sm)",
          padding: "0 var(--sp-3)",
          height: 44,
          transition: "border-color var(--dur) var(--ease)",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {prefix && (
          <span style={{ fontFamily: "var(--font-heading)", color: "var(--accent-price)", marginRight: "var(--sp-2)", fontWeight: 600 }}>
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-body-sm)",
            height: "100%",
          }}
          {...rest}
        />
      </div>
      {hint && (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--text-faint)" }}>{hint}</span>
      )}
    </div>
  );
}
