// RPM Mobile Menu — customer-facing phone menu.
// Composes DS primitives from window.RPMPubDesignSystem_cc2ec6.
function MobileMenu() {
  const NS = window.RPMPubDesignSystem_cc2ec6;
  const { SectionHeader, MenuItem } = NS;
  const data = window.RPM_MENU;
  const cats = data.categories;
  const [active, setActive] = React.useState(cats[0].id);
  const [query, setQuery] = React.useState("");
  const refs = React.useRef({});

  const scrollTo = (id) => {
    setActive(id);
    const el = refs.current[id];
    const scroller = document.getElementById("rpm-scroll");
    if (el && scroller) {
      scroller.scrollTo({ top: el.offsetTop - 96, behavior: "smooth" });
    }
  };

  const filter = (items) =>
    query.trim()
      ? items.filter(
          (i) =>
            i.name.toLowerCase().includes(query.toLowerCase()) ||
            (i.description || "").toLowerCase().includes(query.toLowerCase())
        )
      : items;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--board-wash)", position: "relative" }}>
      {/* grain overlay */}
      <div style={{ position: "absolute", inset: 0, background: "var(--grain)", backgroundSize: "var(--grain-size)", pointerEvents: "none", opacity: .6 }} />

      {/* Header */}
      <header style={{ padding: "18px 20px 12px", borderBottom: "var(--bw) solid var(--border-hairline)", position: "relative", zIndex: 2, background: "rgba(18,17,16,.7)", backdropFilter: "blur(6px)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-accent)", fontSize: 30, color: "var(--rpm-cream)", lineHeight: 1 }}>
            <span style={{ color: "var(--accent-primary)" }}>R</span>PM
          </span>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".16em", fontSize: 10, color: "var(--accent-secondary)" }}>
            Patio Pub &amp; Grill
          </span>
        </div>
        {/* search */}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, background: "var(--surface-inset)", border: "var(--bw) solid var(--border-strong)", borderRadius: "var(--radius-sm)", padding: "0 12px", height: 40 }}>
          <span style={{ color: "var(--text-faint)", fontSize: 14 }}>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the board…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: 15 }}
          />
        </div>
      </header>

      {/* Category chips */}
      <nav style={{ display: "flex", gap: 8, padding: "12px 20px", overflowX: "auto", borderBottom: "var(--bw) solid var(--border-hairline)", position: "relative", zIndex: 2, background: "rgba(18,17,16,.7)" }}>
        {cats.map((c) => (
          <button
            key={c.id}
            onClick={() => scrollTo(c.id)}
            style={{
              flexShrink: 0, cursor: "pointer",
              fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 12,
              textTransform: "uppercase", letterSpacing: ".06em",
              padding: "7px 12px", borderRadius: "var(--radius-sm)",
              border: "var(--bw) solid " + (active === c.id ? "var(--accent-primary)" : "var(--border-strong)"),
              background: active === c.id ? "var(--accent-primary)" : "transparent",
              color: active === c.id ? "#fff" : "var(--text-secondary)",
              transition: "all var(--dur) var(--ease)",
            }}
          >
            {c.title.split(" · ")[0]}
          </button>
        ))}
      </nav>

      {/* Scrollable sections */}
      <div id="rpm-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 20px 40px", position: "relative", zIndex: 1 }}>
        {cats.map((c) => {
          const items = filter(c.items);
          if (items.length === 0) return null;
          return (
            <section key={c.id} ref={(el) => (refs.current[c.id] = el)} style={{ paddingTop: 24 }}>
              <SectionHeader color={c.color} stars={c.stars} size="md">{c.title}</SectionHeader>
              {c.intro && (
                <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 13, color: "var(--text-muted)", margin: "8px 0 0", lineHeight: 1.4 }}>{c.intro}</p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 18 }}>
                {items.map((it, i) => <MenuItem key={i} {...it} priceSize="md" />)}
              </div>
            </section>
          );
        })}
        <div style={{ textAlign: "center", marginTop: 40, fontFamily: "var(--font-heading)", textTransform: "uppercase", letterSpacing: ".14em", fontSize: 11, color: "var(--accent-primary)" }}>
          ★ Live Music · Pet Friendly Patio ★
        </div>
      </div>
    </div>
  );
}
window.MobileMenu = MobileMenu;
