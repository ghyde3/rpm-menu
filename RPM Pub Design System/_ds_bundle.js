/* @ds-bundle: {"format":4,"namespace":"RPMPubDesignSystem_cc2ec6","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"Switch","sourcePath":"components/core/Switch.jsx"},{"name":"Textarea","sourcePath":"components/core/Textarea.jsx"},{"name":"MenuItem","sourcePath":"components/menu/MenuItem.jsx"},{"name":"MenuSection","sourcePath":"components/menu/MenuSection.jsx"},{"name":"PriceTag","sourcePath":"components/menu/PriceTag.jsx"},{"name":"SectionHeader","sourcePath":"components/menu/SectionHeader.jsx"},{"name":"Tag","sourcePath":"components/menu/Tag.jsx"}],"sourceHashes":{"components/core/Button.jsx":"391d40fd9788","components/core/Card.jsx":"87b121d75272","components/core/Input.jsx":"ed2bb94e76d4","components/core/Switch.jsx":"348c87425269","components/core/Textarea.jsx":"1867061ff76e","components/menu/MenuItem.jsx":"a29a8cf75611","components/menu/MenuSection.jsx":"f4583b75d957","components/menu/PriceTag.jsx":"0fa7b1699f12","components/menu/SectionHeader.jsx":"79c0a32aa581","components/menu/Tag.jsx":"357aaadc8a0d","ui_kits/cms/CmsApp.jsx":"343e9064648e","ui_kits/menu-data.js":"f775b7e4e023","ui_kits/mobile_menu/MobileMenu.jsx":"24b395614086","ui_kits/tv_board/TVBoard.jsx":"7753252aa2be"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.RPMPubDesignSystem_cc2ec6 = window.RPMPubDesignSystem_cc2ec6 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * RPM Button — chunky, flat, hard-edged bar-signage button.
 * Variants: primary (hot-rod red), secondary (outline), ghost, danger.
 */
function Button({
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
    sm: {
      padding: "0 var(--sp-3)",
      height: 34,
      fontSize: "0.8125rem"
    },
    md: {
      padding: "0 var(--sp-5)",
      height: 44,
      fontSize: "0.9375rem"
    },
    lg: {
      padding: "0 var(--sp-6)",
      height: 54,
      fontSize: "1.0625rem"
    }
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
    ...sizes[size]
  };
  const variants = {
    primary: {
      background: "var(--accent-primary)",
      color: "#fff",
      borderColor: "var(--accent-primary)",
      boxShadow: "var(--shadow-sm)"
    },
    secondary: {
      background: "transparent",
      color: "var(--text-primary)",
      borderColor: "var(--border-strong)"
    },
    ghost: {
      background: "transparent",
      color: "var(--text-secondary)",
      borderColor: "transparent"
    },
    danger: {
      background: "transparent",
      color: "var(--accent-primary)",
      borderColor: "var(--accent-primary)"
    }
  };
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const hoverStyle = !disabled && hover ? {
    primary: {
      background: "var(--accent-primary-press)",
      borderColor: "var(--accent-primary-press)"
    },
    secondary: {
      borderColor: "var(--text-primary)",
      background: "var(--surface-hover)"
    },
    ghost: {
      color: "var(--text-primary)",
      background: "var(--surface-hover)"
    },
    danger: {
      background: "var(--accent-primary)",
      color: "#fff"
    }
  }[variant] : null;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      ...base,
      ...variants[variant],
      ...hoverStyle,
      transform: press && !disabled ? "translateY(1px)" : "none",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * RPM Card — matte raised panel with a hairline border and hard corners.
 * The workhorse container for CMS forms and list rows.
 */
function Card({
  children,
  padded = true,
  accent = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: "var(--surface-raised)",
      border: "var(--bw) solid var(--border-hairline)",
      borderLeft: accent ? "var(--bw-chunk) solid var(--accent-primary)" : undefined,
      borderRadius: "var(--radius-md)",
      padding: padded ? "var(--sp-5)" : 0,
      boxShadow: "var(--shadow-sm)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * RPM Input — dark inset text field with a chunky border that lights red on focus.
 * Pairs a caps Oswald label above the control. Use across the CMS.
 */
function Input({
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
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-2)",
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontFamily: "var(--font-heading)",
      fontSize: "0.75rem",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "var(--ls-caps)",
      color: "var(--text-muted)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      background: "var(--surface-inset)",
      border: "var(--bw) solid " + (focus ? "var(--accent-primary)" : "var(--border-strong)"),
      borderRadius: "var(--radius-sm)",
      padding: "0 var(--sp-3)",
      height: 44,
      transition: "border-color var(--dur) var(--ease)",
      opacity: disabled ? 0.5 : 1
    }
  }, prefix && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-heading)",
      color: "var(--accent-price)",
      marginRight: "var(--sp-2)",
      fontWeight: 600
    }
  }, prefix), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      background: "transparent",
      border: "none",
      outline: "none",
      color: "var(--text-primary)",
      fontFamily: "var(--font-body)",
      fontSize: "var(--fs-body-sm)",
      height: "100%"
    }
  }, rest))), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-body)",
      fontSize: "0.8125rem",
      color: "var(--text-faint)"
    }
  }, hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/Switch.jsx
try { (() => {
/**
 * RPM Switch — availability toggle. ON = kustom green ("86 it" when off).
 * Square-ish track with a hard knob, matching the flat signage aesthetic.
 */
function Switch({
  checked = false,
  onChange,
  label,
  disabled = false,
  id,
  style
}) {
  const inputId = id || (label ? "sw-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
  const w = 46,
    h = 26,
    pad = 3,
    knob = h - pad * 2;
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      width: w,
      height: h,
      flexShrink: 0,
      background: checked ? "var(--accent-new)" : "var(--surface-inset)",
      border: "var(--bw) solid " + (checked ? "var(--accent-new)" : "var(--border-strong)"),
      borderRadius: "var(--radius-pill)",
      transition: "background var(--dur) var(--ease), border-color var(--dur) var(--ease)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: pad - 2,
      left: checked ? w - knob - pad - 2 : pad - 2,
      width: knob,
      height: knob,
      borderRadius: "var(--radius-pill)",
      background: checked ? "#16240a" : "var(--rpm-steel)",
      transition: "left var(--dur) var(--ease), background var(--dur) var(--ease)"
    }
  })), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-heading)",
      fontSize: "0.875rem",
      fontWeight: 500,
      color: "var(--text-secondary)",
      textTransform: "uppercase",
      letterSpacing: "var(--ls-caps)"
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    id: inputId,
    type: "checkbox",
    checked: checked,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      position: "absolute",
      opacity: 0,
      width: 0,
      height: 0
    }
  }));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Switch.jsx", error: String((e && e.message) || e) }); }

// components/core/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** RPM Textarea — multi-line dark field for item descriptions. */
function Textarea({
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
}) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || (label ? "ta-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-2)",
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontFamily: "var(--font-heading)",
      fontSize: "0.75rem",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "var(--ls-caps)",
      color: "var(--text-muted)"
    }
  }, label), /*#__PURE__*/React.createElement("textarea", _extends({
    id: inputId,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    rows: rows,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
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
      opacity: disabled ? 0.5 : 1
    }
  }, rest)), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-body)",
      fontSize: "0.8125rem",
      color: "var(--text-faint)"
    }
  }, hint));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/menu/PriceTag.jsx
try { (() => {
/**
 * RPM PriceTag — renders the classic board price with superscript cents:
 * dollars big, cents small and raised (e.g. 12⁹⁹). Half-price shown inline.
 */
function PriceTag({
  price,
  size = "md",
  color = "var(--accent-price)",
  style
}) {
  // Accept number (12.99) or string ("12.99", "12", "half 12.99").
  const raw = String(price).trim();
  const num = raw.replace(/[^0-9.]/g, "");
  const [dollars, centsRaw] = num.split(".");
  const cents = (centsRaw || "").padEnd(2, "0").slice(0, 2) || "99";
  const scale = {
    sm: 1,
    md: 1.375,
    lg: 2,
    xl: 3.25
  }[size] || 1.375;
  const dollarSize = scale + "rem";
  const centSize = scale * 0.52 + "rem";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-heading)",
      fontWeight: 700,
      color,
      whiteSpace: "nowrap",
      lineHeight: 1,
      display: "inline-flex",
      alignItems: "flex-start",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: dollarSize
    }
  }, dollars), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: centSize,
      marginLeft: 1,
      marginTop: "0.06em"
    }
  }, cents));
}
Object.assign(__ds_scope, { PriceTag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/menu/PriceTag.jsx", error: String((e && e.message) || e) }); }

// components/menu/SectionHeader.jsx
try { (() => {
/**
 * RPM SectionHeader — the big flame-colored board header (SANDWICHES, SALADS,
 * DESSERTS). Anton caps, hot-rod red or flame orange, optional star flankers
 * echoing the "★ BASKETS ★ DOGS" treatment on the printed board.
 */
function SectionHeader({
  children,
  color = "var(--accent-primary)",
  stars = false,
  align = "left",
  size = "lg",
  style
}) {
  const fs = {
    md: "var(--fs-h3)",
    lg: "var(--fs-h2)",
    xl: "var(--fs-h1)"
  }[size] || "var(--fs-h2)";
  const Star = () => /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--accent-price)",
      fontSize: "0.6em",
      margin: "0 0.4em",
      verticalAlign: "0.18em"
    }
  }, "\u2605");
  return /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 400,
      fontSize: fs,
      lineHeight: "var(--lh-tight)",
      letterSpacing: "var(--ls-display)",
      textTransform: "uppercase",
      color,
      margin: 0,
      textAlign: align,
      textShadow: "0 2px 0 rgba(0,0,0,0.45)",
      ...style
    }
  }, stars && /*#__PURE__*/React.createElement(Star, null), children, stars && /*#__PURE__*/React.createElement(Star, null));
}
Object.assign(__ds_scope, { SectionHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/menu/SectionHeader.jsx", error: String((e && e.message) || e) }); }

// components/menu/Tag.jsx
try { (() => {
/**
 * RPM Tag — small caps chip for item attributes: NEW, SPICY, GF, VEGGIE,
 * FAN FAVE, etc. Flat with a chunky border. Tones map to the palette.
 */
function Tag({
  children,
  tone = "default",
  style
}) {
  const tones = {
    default: {
      color: "var(--text-secondary)",
      border: "var(--border-strong)",
      bg: "transparent"
    },
    new: {
      color: "#16240a",
      border: "var(--accent-new)",
      bg: "var(--accent-new)"
    },
    spicy: {
      color: "#fff",
      border: "var(--accent-primary)",
      bg: "var(--accent-primary)"
    },
    veggie: {
      color: "var(--accent-new)",
      border: "var(--accent-new)",
      bg: "transparent"
    },
    fave: {
      color: "var(--accent-price)",
      border: "var(--accent-price)",
      bg: "transparent"
    }
  };
  const t = tones[tone] || tones.default;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      fontFamily: "var(--font-heading)",
      fontSize: "0.6875rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "var(--ls-wide)",
      lineHeight: 1,
      padding: "5px 8px 4px",
      color: t.color,
      background: t.bg,
      border: "1.5px solid " + t.border,
      borderRadius: "var(--radius-sm)",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/menu/Tag.jsx", error: String((e && e.message) || e) }); }

// components/menu/MenuItem.jsx
try { (() => {
/**
 * RPM MenuItem — one board row: bold flame-orange title, dotted leader line to
 * an amber superscript price, slab-serif description beneath, optional attribute
 * tags. Unavailable items dim and strike through ("86'd").
 */
function MenuItem({
  name,
  description,
  price,
  note,
  tags = [],
  available = true,
  leaders = true,
  priceSize = "md",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      opacity: available ? 1 : 0.4,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: "var(--sp-2)"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-heading)",
      fontWeight: 700,
      fontStyle: "italic",
      fontSize: "var(--fs-title)",
      lineHeight: "var(--lh-snug)",
      textTransform: "uppercase",
      letterSpacing: "0.01em",
      color: "var(--accent-secondary)",
      margin: 0,
      whiteSpace: "nowrap",
      textDecoration: available ? "none" : "line-through"
    }
  }, name), leaders && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      flex: 1,
      marginBottom: "0.35em",
      height: 0,
      borderBottom: "2px dotted var(--leader-dots)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "-0.06em"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.PriceTag, {
    price: price,
    size: priceSize
  }))), description && /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-body)",
      fontSize: "var(--fs-body)",
      lineHeight: "var(--lh-body)",
      color: "var(--text-secondary)",
      margin: "var(--sp-2) 0 0",
      maxWidth: "52ch"
    }
  }, description), (note || tags.length > 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "var(--sp-2)",
      marginTop: "var(--sp-3)"
    }
  }, tags.map((t, i) => typeof t === "string" ? /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    key: i
  }, t) : /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    key: i,
    tone: t.tone
  }, t.label)), note && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-body)",
      fontStyle: "italic",
      fontSize: "var(--fs-body-sm)",
      color: "var(--text-muted)"
    }
  }, note)));
}
Object.assign(__ds_scope, { MenuItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/menu/MenuItem.jsx", error: String((e && e.message) || e) }); }

// components/menu/MenuSection.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * RPM MenuSection — a titled board block: SectionHeader + a stack of MenuItems.
 * Accepts an `items` array or arbitrary children. Optional intro note (the
 * fine print like "All sandwich prices include one side").
 */
function MenuSection({
  title,
  color,
  stars = false,
  intro,
  items,
  children,
  headerSize = "lg",
  priceSize = "md",
  style
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SectionHeader, {
    color: color,
    stars: stars,
    size: headerSize
  }, title), intro && /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-body)",
      fontStyle: "italic",
      fontSize: "var(--fs-body-sm)",
      color: "var(--text-muted)",
      margin: "var(--sp-3) 0 0",
      lineHeight: "var(--lh-body)"
    }
  }, intro), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--row-gap)",
      marginTop: "var(--sp-5)"
    }
  }, items ? items.map((it, i) => /*#__PURE__*/React.createElement(__ds_scope.MenuItem, _extends({
    key: i,
    priceSize: priceSize
  }, it))) : children));
}
Object.assign(__ds_scope, { MenuSection });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/menu/MenuSection.jsx", error: String((e && e.message) || e) }); }

// ui_kits/cms/CmsApp.jsx
try { (() => {
// RPM Menu Manager — minimal CMS for the single-restaurant menu.
// Composes DS primitives; edits live React state (mock persistence).
function CmsApp() {
  const NS = window.RPMPubDesignSystem_cc2ec6;
  const {
    Button,
    Input,
    Textarea,
    Switch,
    Card,
    Tag,
    PriceTag
  } = NS;

  // Seed editable state from the shared menu data.
  const seed = JSON.parse(JSON.stringify(window.RPM_MENU.categories)).map(c => ({
    ...c,
    items: c.items.map(it => ({
      available: true,
      ...it
    }))
  }));
  const [cats, setCats] = React.useState(seed);
  const [activeCat, setActiveCat] = React.useState(seed[0].id);
  const [editing, setEditing] = React.useState(null); // {catId, index} | "new" | null
  const [dirty, setDirty] = React.useState(false);
  const [published, setPublished] = React.useState(true);
  const cat = cats.find(c => c.id === activeCat);
  const markDirty = () => {
    setDirty(true);
    setPublished(false);
  };
  const toggleAvail = idx => {
    setCats(cs => cs.map(c => c.id !== activeCat ? c : {
      ...c,
      items: c.items.map((it, i) => i === idx ? {
        ...it,
        available: !it.available
      } : it)
    }));
    markDirty();
  };
  const draftFor = () => {
    if (editing === "new") return {
      name: "",
      price: "",
      description: "",
      available: true,
      tags: []
    };
    if (editing) return cat.items[editing.index];
    return null;
  };
  const [draft, setDraft] = React.useState(null);
  React.useEffect(() => {
    setDraft(draftFor());
  }, [editing]);
  const saveDraft = () => {
    setCats(cs => cs.map(c => {
      if (c.id !== activeCat) return c;
      if (editing === "new") return {
        ...c,
        items: [...c.items, {
          ...draft,
          price: parseFloat(draft.price) || 0
        }]
      };
      return {
        ...c,
        items: c.items.map((it, i) => i === editing.index ? {
          ...draft,
          price: parseFloat(draft.price) || draft.price
        } : it)
      };
    }));
    markDirty();
    setEditing(null);
  };
  const deleteItem = () => {
    if (editing === "new") {
      setEditing(null);
      return;
    }
    setCats(cs => cs.map(c => c.id !== activeCat ? c : {
      ...c,
      items: c.items.filter((_, i) => i !== editing.index)
    }));
    markDirty();
    setEditing(null);
  };
  const railW = 240,
    drawerW = editing ? 380 : 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "var(--surface-base)",
      fontFamily: "var(--font-body)"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      height: 68,
      borderBottom: "var(--bw) solid var(--border-hairline)",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-accent)",
      fontSize: 26,
      color: "var(--rpm-cream)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--accent-primary)"
    }
  }, "R"), "PM"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-heading)",
      textTransform: "uppercase",
      letterSpacing: ".14em",
      fontSize: 13,
      color: "var(--text-muted)"
    }
  }, "Menu Manager")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      fontFamily: "var(--font-heading)",
      textTransform: "uppercase",
      letterSpacing: ".08em",
      fontSize: 12,
      color: published ? "var(--accent-new)" : "var(--accent-price)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: "50%",
      background: "currentColor",
      boxShadow: published ? "var(--glow-toxic)" : "none"
    }
  }), published ? "Board Live" : "Unpublished changes"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    disabled: published,
    onClick: () => {
      setPublished(true);
      setDirty(false);
    }
  }, "Publish to Board"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      width: railW,
      flexShrink: 0,
      borderRight: "var(--bw) solid var(--border-hairline)",
      padding: "16px 12px",
      overflowY: "auto",
      background: "var(--surface-raised)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-heading)",
      textTransform: "uppercase",
      letterSpacing: ".1em",
      fontSize: 11,
      color: "var(--text-faint)",
      padding: "0 8px 10px"
    }
  }, "Categories"), cats.map(c => {
    const on = c.id === activeCat;
    const live = c.items.filter(i => i.available).length;
    return /*#__PURE__*/React.createElement("button", {
      key: c.id,
      onClick: () => {
        setActiveCat(c.id);
        setEditing(null);
      },
      style: {
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 8px",
        marginBottom: 2,
        borderRadius: "var(--radius-sm)",
        border: "none",
        borderLeft: "3px solid " + (on ? "var(--accent-primary)" : "transparent"),
        background: on ? "var(--surface-inset)" : "transparent",
        fontFamily: "var(--font-heading)",
        fontSize: 14,
        fontWeight: 500,
        color: on ? "var(--text-primary)" : "var(--text-secondary)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, c.title.split(" · ")[0]), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-body)",
        fontSize: 12,
        color: "var(--text-faint)"
      }
    }, live, "/", c.items.length));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 8px 0"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    fullWidth: true
  }, "+ Add Category"))), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      minWidth: 0,
      overflowY: "auto",
      padding: "24px 28px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      textTransform: "uppercase",
      color: "var(--accent-primary)",
      fontSize: 40,
      margin: 0,
      lineHeight: 1
    }
  }, cat.title.split(" · ")[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--text-muted)",
      fontSize: 14,
      marginTop: 6
    }
  }, cat.items.length, " items \xB7 ", cat.items.filter(i => i.available).length, " on the board")), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => setEditing("new")
  }, "+ Add Item")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, cat.items.map((it, i) => {
    const isEd = editing && editing !== "new" && editing.index === i;
    return /*#__PURE__*/React.createElement(Card, {
      key: i,
      accent: isEd,
      padded: false,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 16px",
        opacity: it.available ? 1 : 0.55
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-faint)",
        fontSize: 16,
        cursor: "grab",
        letterSpacing: "2px",
        userSelect: "none"
      }
    }, "\u283F"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-heading)",
        fontWeight: 600,
        fontStyle: "italic",
        textTransform: "uppercase",
        color: "var(--accent-secondary)",
        fontSize: 16,
        textDecoration: it.available ? "none" : "line-through"
      }
    }, it.name || "Untitled"), (it.tags || []).map((t, k) => /*#__PURE__*/React.createElement(Tag, {
      key: k,
      tone: t.tone
    }, t.label))), /*#__PURE__*/React.createElement("div", {
      style: {
        color: "var(--text-muted)",
        fontSize: 13,
        marginTop: 3,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 520
      }
    }, it.description)), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 64,
        textAlign: "right"
      }
    }, /*#__PURE__*/React.createElement(PriceTag, {
      price: it.price || 0,
      size: "sm"
    })), /*#__PURE__*/React.createElement(Switch, {
      checked: it.available,
      onChange: () => toggleAvail(i)
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      onClick: () => setEditing({
        catId: activeCat,
        index: i
      })
    }, "Edit"));
  }))), editing && draft && /*#__PURE__*/React.createElement("aside", {
    style: {
      width: drawerW,
      flexShrink: 0,
      borderLeft: "var(--bw) solid var(--border-hairline)",
      background: "var(--surface-raised)",
      padding: "24px",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-heading)",
      textTransform: "uppercase",
      letterSpacing: ".06em",
      color: "var(--text-primary)",
      fontSize: 18,
      margin: 0
    }
  }, editing === "new" ? "New Item" : "Edit Item"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditing(null),
    style: {
      background: "none",
      border: "none",
      color: "var(--text-muted)",
      fontSize: 22,
      cursor: "pointer",
      lineHeight: 1
    }
  }, "\xD7")), /*#__PURE__*/React.createElement(Input, {
    label: "Item Name",
    value: draft.name,
    onChange: e => setDraft({
      ...draft,
      name: e.target.value
    }),
    placeholder: "Monster Reuben"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Price",
    prefix: "$",
    value: String(draft.price),
    onChange: e => setDraft({
      ...draft,
      price: e.target.value
    }),
    placeholder: "15.99",
    hint: "Cents render as superscript on the board"
  }), /*#__PURE__*/React.createElement(Textarea, {
    label: "Description",
    rows: 4,
    value: draft.description,
    onChange: e => setDraft({
      ...draft,
      description: e.target.value
    }),
    placeholder: "Corned beef, kraut, swiss & thousand island\u2026"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-heading)",
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: ".06em",
      color: "var(--text-muted)",
      marginBottom: 10
    }
  }, "Attributes"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, [{
    label: "New",
    tone: "new"
  }, {
    label: "Fan Fave",
    tone: "fave"
  }, {
    label: "Spicy",
    tone: "spicy"
  }, {
    label: "Veggie",
    tone: "veggie"
  }].map(opt => {
    const on = (draft.tags || []).some(t => t.label === opt.label);
    return /*#__PURE__*/React.createElement("button", {
      key: opt.label,
      onClick: () => setDraft({
        ...draft,
        tags: on ? draft.tags.filter(t => t.label !== opt.label) : [...(draft.tags || []), opt]
      }),
      style: {
        cursor: "pointer",
        background: "none",
        border: "none",
        padding: 0,
        opacity: on ? 1 : 0.4
      }
    }, /*#__PURE__*/React.createElement(Tag, {
      tone: opt.tone
    }, opt.label));
  }))), /*#__PURE__*/React.createElement(Switch, {
    checked: draft.available,
    onChange: v => setDraft({
      ...draft,
      available: v
    }),
    label: draft.available ? "On the board" : "86'd — hidden"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto",
      display: "flex",
      gap: 10,
      paddingTop: 12
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: saveDraft,
    style: {
      flex: 1
    }
  }, editing === "new" ? "Add Item" : "Save"), /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    onClick: deleteItem
  }, editing === "new" ? "Discard" : "Delete")))));
}
window.CmsApp = CmsApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/cms/CmsApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/menu-data.js
try { (() => {
// RPM menu data — transcribed from the printed board. Shared by all UI kits.
// Prices are numbers; cents render as superscript via PriceTag.
window.RPM_MENU = {
  restaurant: {
    name: "RPM",
    tagline: "Full Service Patio Pub & Grill",
    location: "Historic Downtown Newnan, GA",
    hours: "Kitchen til 10 · Bar til Late"
  },
  categories: [{
    id: "sandwiches",
    title: "Sandwiches · Baskets · Dogs",
    stars: true,
    color: "var(--accent-primary)",
    intro: "Sub tortilla wraps for any sandwich +1.50 · all sandwich prices include one side of your choice.",
    items: [{
      name: "Blackened Chicken BLT",
      price: 12.99,
      description: "Blackened chicken breast with lettuce, tomato, bacon & our delicious basil aioli on a ciabatta bun.",
      note: "sub grilled salmon 15.99"
    }, {
      name: "The Philly",
      price: 13.99,
      description: "Prime rib or chicken chopped w/ sautéed onions & peppers covered w/ provo on a hoagie."
    }, {
      name: "Monster Reuben",
      price: 15.99,
      description: "Corned beef, kraut, swiss & thousand island on toasted marble rye.",
      note: "half 12.99",
      tags: [{
        label: "Fan Fave",
        tone: "fave"
      }]
    }, {
      name: "Cod of Thunder",
      price: 16.99,
      description: "Our monster po' boy stuffed w/ fried cod, shrimp, lettuce, tomato & topped w/ chipotle aioli."
    }, {
      name: "Fish & Chips",
      price: 12.99,
      description: "Beer battered cod served w/ homemade slaw & tartar sauce."
    }, {
      name: "The Angler",
      price: 12.99,
      description: "Beer battered cod on a ciabatta bun w/ lettuce, tomato & bacon, slathered w/ tartar."
    }, {
      name: "The Bratweiler",
      price: 11.99,
      description: "Big bratwurst topped w/ sautéed kraut, peppers, onions & sharp cheddar on a hoagie roll."
    }, {
      name: "Chicken Jabroni",
      price: 11.99,
      description: "Deep fried chicken breast, tossed in master blaster sauce, covered with blue cheese & pickles on a ciabatta bun.",
      tags: [{
        label: "Master Blaster",
        tone: "spicy"
      }]
    }, {
      name: "Chicken Tenders Basket",
      price: 10.99,
      description: "Served with your choice of fries, o-rings or tots."
    }, {
      name: "Fried Shrimp Basket",
      price: 9.99,
      description: "Comes with a side plus our tartar sauce or cocktail sauce. Try them tossed in your choice of wing sauces!"
    }, {
      name: "The Frankster",
      price: 13.99,
      description: "Two all beef jumbo Nathan's topped w/ black bean chili, cheese, jalapenos & slaw on the side.",
      note: "9.99 / one"
    }, {
      name: "Road Dogs",
      price: 12.99,
      description: "Two all beef jumbo Nathan's covered w/ sautéed onions, peppers & kraut.",
      note: "9.99 / one"
    }]
  }, {
    id: "salads",
    title: "Salads",
    color: "var(--accent-primary)",
    items: [{
      name: "Haus Salad",
      price: 14.99,
      description: "Fresh bed of greens topped w/ corned beef, kraut, thousand island dressing & fried Bavarian pretzel croutons."
    }, {
      name: "Blackened Salmon Caesar",
      price: 15.99,
      description: "North Atlantic salmon over greens tossed with Caesar dressing, shredded parmesan and cracked black pepper."
    }, {
      name: "The Gringo",
      price: 13.99,
      description: "Grilled onions and peppers with steak or chicken, atop fresh greens, tomatoes and cheddar with ranch dressing."
    }, {
      name: "The Hungry Hippie",
      price: 12.99,
      description: "Big pile of greens, tomatoes, onions, peppers, carrots, cucumber, black bean salad and rye croutons. Your choice of dressing.",
      tags: [{
        label: "Veggie",
        tone: "veggie"
      }]
    }, {
      name: "Big-A-Pasta Salad",
      price: 10.99,
      description: "Homemade and delicious. Now available in a big bowl!"
    }]
  }, {
    id: "sides",
    title: "Sides",
    color: "var(--accent-secondary)",
    items: [{
      name: "The Lineup",
      price: 4.99,
      description: "O-rings, tater tots, fries, pork rinds, cole slaw, potato salad, pasta salad, fresh fruit, sautéed veggies, small house salad, black bean salad, soup of the day."
    }]
  }, {
    id: "desserts",
    title: "Desserts",
    color: "var(--accent-primary)",
    items: [{
      name: "Cheech & Chong",
      price: 6.99,
      description: "Fried cheesecake rolled up fat.",
      tags: [{
        label: "Fan Fave",
        tone: "fave"
      }]
    }, {
      name: "Dessert of the Day",
      price: 0,
      description: "Ask your server. Prices and availability may differ.",
      note: "market price"
    }]
  }, {
    id: "drinks",
    title: "On Tap · Pepsi Products",
    color: "var(--accent-secondary)",
    intro: "15 rotating drafts + a full bar of spirits & wines.",
    items: [{
      name: "Draft Beer",
      price: 6.0,
      description: "15 rotating taps — ask your bartender what's pouring today.",
      tags: [{
        label: "On Tap",
        tone: "new"
      }]
    }, {
      name: "Well Spirits",
      price: 7.0,
      description: "Great list of spirits. Add a mixer, no charge."
    }, {
      name: "House Wine",
      price: 8.0,
      description: "Red or white by the glass."
    }, {
      name: "Fountain",
      price: 2.99,
      description: "Pepsi, Diet Pepsi, Dr. Pepper, Mt. Dew, Sierra Mist, Lemonade, Coffee, Sweet & Unsweet Tea."
    }]
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/menu-data.js", error: String((e && e.message) || e) }); }

// ui_kits/mobile_menu/MobileMenu.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// RPM Mobile Menu — customer-facing phone menu.
// Composes DS primitives from window.RPMPubDesignSystem_cc2ec6.
function MobileMenu() {
  const NS = window.RPMPubDesignSystem_cc2ec6;
  const {
    SectionHeader,
    MenuItem
  } = NS;
  const data = window.RPM_MENU;
  const cats = data.categories;
  const [active, setActive] = React.useState(cats[0].id);
  const [query, setQuery] = React.useState("");
  const refs = React.useRef({});
  const scrollTo = id => {
    setActive(id);
    const el = refs.current[id];
    const scroller = document.getElementById("rpm-scroll");
    if (el && scroller) {
      scroller.scrollTo({
        top: el.offsetTop - 96,
        behavior: "smooth"
      });
    }
  };
  const filter = items => query.trim() ? items.filter(i => i.name.toLowerCase().includes(query.toLowerCase()) || (i.description || "").toLowerCase().includes(query.toLowerCase())) : items;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "var(--board-wash)",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "var(--grain)",
      backgroundSize: "var(--grain-size)",
      pointerEvents: "none",
      opacity: .6
    }
  }), /*#__PURE__*/React.createElement("header", {
    style: {
      padding: "18px 20px 12px",
      borderBottom: "var(--bw) solid var(--border-hairline)",
      position: "relative",
      zIndex: 2,
      background: "rgba(18,17,16,.7)",
      backdropFilter: "blur(6px)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-accent)",
      fontSize: 30,
      color: "var(--rpm-cream)",
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--accent-primary)"
    }
  }, "R"), "PM"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-heading)",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: ".16em",
      fontSize: 10,
      color: "var(--accent-secondary)"
    }
  }, "Patio Pub & Grill")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: "var(--surface-inset)",
      border: "var(--bw) solid var(--border-strong)",
      borderRadius: "var(--radius-sm)",
      padding: "0 12px",
      height: 40
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-faint)",
      fontSize: 14
    }
  }, "\u2315"), /*#__PURE__*/React.createElement("input", {
    value: query,
    onChange: e => setQuery(e.target.value),
    placeholder: "Search the board\u2026",
    style: {
      flex: 1,
      background: "transparent",
      border: "none",
      outline: "none",
      color: "var(--text-primary)",
      fontFamily: "var(--font-body)",
      fontSize: 15
    }
  }))), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: 8,
      padding: "12px 20px",
      overflowX: "auto",
      borderBottom: "var(--bw) solid var(--border-hairline)",
      position: "relative",
      zIndex: 2,
      background: "rgba(18,17,16,.7)"
    }
  }, cats.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    onClick: () => scrollTo(c.id),
    style: {
      flexShrink: 0,
      cursor: "pointer",
      fontFamily: "var(--font-heading)",
      fontWeight: 600,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: ".06em",
      padding: "7px 12px",
      borderRadius: "var(--radius-sm)",
      border: "var(--bw) solid " + (active === c.id ? "var(--accent-primary)" : "var(--border-strong)"),
      background: active === c.id ? "var(--accent-primary)" : "transparent",
      color: active === c.id ? "#fff" : "var(--text-secondary)",
      transition: "all var(--dur) var(--ease)"
    }
  }, c.title.split(" · ")[0]))), /*#__PURE__*/React.createElement("div", {
    id: "rpm-scroll",
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "8px 20px 40px",
      position: "relative",
      zIndex: 1
    }
  }, cats.map(c => {
    const items = filter(c.items);
    if (items.length === 0) return null;
    return /*#__PURE__*/React.createElement("section", {
      key: c.id,
      ref: el => refs.current[c.id] = el,
      style: {
        paddingTop: 24
      }
    }, /*#__PURE__*/React.createElement(SectionHeader, {
      color: c.color,
      stars: c.stars,
      size: "md"
    }, c.title), c.intro && /*#__PURE__*/React.createElement("p", {
      style: {
        fontFamily: "var(--font-body)",
        fontStyle: "italic",
        fontSize: 13,
        color: "var(--text-muted)",
        margin: "8px 0 0",
        lineHeight: 1.4
      }
    }, c.intro), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 22,
        marginTop: 18
      }
    }, items.map((it, i) => /*#__PURE__*/React.createElement(MenuItem, _extends({
      key: i
    }, it, {
      priceSize: "md"
    })))));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 40,
      fontFamily: "var(--font-heading)",
      textTransform: "uppercase",
      letterSpacing: ".14em",
      fontSize: 11,
      color: "var(--accent-primary)"
    }
  }, "\u2605 Live Music \xB7 Pet Friendly Patio \u2605")));
}
window.MobileMenu = MobileMenu;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_menu/MobileMenu.jsx", error: String((e && e.message) || e) }); }

// ui_kits/tv_board/TVBoard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// RPM TV Board — big-screen menu display (1920×1080), auto-scaled to fit.
// Rotates through board "pages" and composes DS primitives.
function TVBoard() {
  const NS = window.RPMPubDesignSystem_cc2ec6;
  const {
    SectionHeader,
    MenuItem
  } = NS;
  const data = window.RPM_MENU;

  // Board pages: which categories show together on each screen.
  const pages = [["sandwiches"], ["salads", "desserts", "drinks"]];
  const [page, setPage] = React.useState(0);
  const [auto, setAuto] = React.useState(true);
  const byId = id => data.categories.find(c => c.id === id);
  React.useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setPage(p => (p + 1) % pages.length), 9000);
    return () => clearInterval(t);
  }, [auto]);

  // Fit-to-viewport scaling of the fixed 1920×1080 canvas.
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const cats = pages[page].map(byId);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100vw",
      height: "100vh",
      background: "#000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1920,
      height: 1080,
      transform: `scale(${scale})`,
      transformOrigin: "center",
      position: "relative",
      background: "var(--board-wash)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "var(--grain)",
      backgroundSize: "8px 8px",
      opacity: .5,
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "var(--vignette)",
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "40px 64px 28px",
      borderBottom: "4px solid var(--accent-primary)",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-accent)",
      fontSize: 88,
      color: "var(--rpm-cream)",
      lineHeight: .85
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--accent-primary)"
    }
  }, "R"), "PM"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-heading)",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: ".2em",
      fontSize: 22,
      color: "var(--accent-secondary)"
    }
  }, "Patio Pub & Grill")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-heading)",
      textTransform: "uppercase",
      letterSpacing: ".16em",
      fontSize: 20,
      color: "var(--text-muted)",
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--accent-new)"
    }
  }, "\u25CF 15 On Tap"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, data.restaurant.location))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: cats.length > 1 ? "1fr" : "1fr 1fr",
      gap: "36px 72px",
      padding: "40px 64px",
      height: 812,
      alignContent: "start",
      gridAutoFlow: "column",
      gridTemplateRows: cats.length > 1 ? "repeat(3, auto)" : "auto"
    }
  }, cats.length === 1 ? renderTwoColSection(cats[0], SectionHeader, MenuItem) : cats.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id
  }, /*#__PURE__*/React.createElement(SectionHeader, {
    color: c.color,
    stars: c.stars,
    size: "lg"
  }, c.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 20,
      marginTop: 22
    }
  }, c.items.slice(0, 5).map((it, i) => /*#__PURE__*/React.createElement(MenuItem, _extends({
    key: i
  }, it, {
    priceSize: "lg",
    leaders: true
  }))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 72,
      background: "var(--accent-primary)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      textTransform: "uppercase",
      fontSize: 34,
      color: "#fff",
      letterSpacing: ".04em"
    }
  }, "\u2605 Live Music \u2605 Open Mic Nights \u2605 Pet Friendly Patio \u2605")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 44,
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      gap: 10
    }
  }, pages.map((_, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => {
      setPage(i);
      setAuto(false);
    },
    style: {
      width: 12,
      height: 12,
      borderRadius: "50%",
      border: "none",
      cursor: "pointer",
      background: i === page ? "var(--accent-price)" : "var(--border-strong)"
    }
  })))));
}

// Sandwiches page: one big header, items flowing into two columns.
function renderTwoColSection(c, SectionHeader, MenuItem) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "1 / -1"
    }
  }, /*#__PURE__*/React.createElement(SectionHeader, {
    color: c.color,
    stars: c.stars,
    size: "lg"
  }, c.title), /*#__PURE__*/React.createElement("div", {
    style: {
      columnCount: 2,
      columnGap: 72,
      marginTop: 24
    }
  }, c.items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      breakInside: "avoid",
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(MenuItem, _extends({}, it, {
    priceSize: "lg"
  }))))));
}
window.TVBoard = TVBoard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/tv_board/TVBoard.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.MenuItem = __ds_scope.MenuItem;

__ds_ns.MenuSection = __ds_scope.MenuSection;

__ds_ns.PriceTag = __ds_scope.PriceTag;

__ds_ns.SectionHeader = __ds_scope.SectionHeader;

__ds_ns.Tag = __ds_scope.Tag;

})();
