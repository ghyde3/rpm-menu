import React from "react";

/**
 * RPM Button — chunky, flat, hard-edged bar-signage button.
 * Variants: primary (hot-rod red), secondary (outline), ghost, danger.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  type = "button",
  onClick,
  style,
  ...rest
}) {
  const sizes = {
    sm: { padding: "0 var(--sp-3)", height: 34, fontSize: "0.8125rem" },
    md: { padding: "0 var(--sp-5)", height: 44, fontSize: "0.9375rem" },
    lg: { padding: "0 var(--sp-6)", height: 54, fontSize: "1.0625rem" },
  };

  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--sp-2)",
    fontFamily: "var(--font-heading)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "var(--ls-caps)",
    lineHeight: 1,
    border: "var(--bw) solid transparent",
    borderRadius: "var(--radius-md)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    width: fullWidth ? "100%" : "auto",
    transition: "transform var(--dur-fast) var(--ease), background var(--dur) var(--ease), border-color var(--dur) var(--ease)",
    whiteSpace: "nowrap",
    ...sizes[size],
  };

  const variants = {
    primary: {
      background: "var(--accent-primary)",
      color: "#fff",
      borderColor: "var(--accent-primary)",
      boxShadow: "var(--shadow-sm)",
    },
    secondary: {
      background: "transparent",
      color: "var(--text-primary)",
      borderColor: "var(--border-strong)",
    },
    ghost: {
      background: "transparent",
      color: "var(--text-secondary)",
      borderColor: "transparent",
    },
    danger: {
      background: "transparent",
      color: "var(--accent-primary)",
      borderColor: "var(--accent-primary)",
    },
  };

  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);

  const hoverStyle = !disabled && hover
    ? {
        primary: { background: "var(--accent-primary-press)", borderColor: "var(--accent-primary-press)" },
        secondary: { borderColor: "var(--text-primary)", background: "var(--surface-hover)" },
        ghost: { color: "var(--text-primary)", background: "var(--surface-hover)" },
        danger: { background: "var(--accent-primary)", color: "#fff" },
      }[variant]
    : null;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        ...base,
        ...variants[variant],
        ...hoverStyle,
        transform: press && !disabled ? "translateY(1px)" : "none",
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
