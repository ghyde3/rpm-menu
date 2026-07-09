// RPM TV Board — big-screen menu display (1920×1080), auto-scaled to fit.
// Rotates through board "pages" and composes DS primitives.
function TVBoard() {
  const NS = window.RPMPubDesignSystem_cc2ec6;
  const { SectionHeader, MenuItem } = NS;
  const data = window.RPM_MENU;

  // Board pages: which categories show together on each screen.
  const pages = [
    ["sandwiches"],
    ["salads", "desserts", "drinks"],
  ];
  const [page, setPage] = React.useState(0);
  const [auto, setAuto] = React.useState(true);
  const byId = (id) => data.categories.find((c) => c.id === id);

  React.useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pages.length), 9000);
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

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "center", position: "relative", background: "var(--board-wash)", overflow: "hidden" }}>
        {/* grain + vignette */}
        <div style={{ position: "absolute", inset: 0, background: "var(--grain)", backgroundSize: "8px 8px", opacity: .5, pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, background: "var(--vignette)", pointerEvents: "none" }} />

        {/* Masthead */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "40px 64px 28px", borderBottom: "4px solid var(--accent-primary)", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <span style={{ fontFamily: "var(--font-accent)", fontSize: 88, color: "var(--rpm-cream)", lineHeight: .85 }}>
              <span style={{ color: "var(--accent-primary)" }}>R</span>PM
            </span>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".2em", fontSize: 22, color: "var(--accent-secondary)" }}>
              Patio Pub &amp; Grill
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-heading)", textTransform: "uppercase", letterSpacing: ".16em", fontSize: 20, color: "var(--text-muted)", textAlign: "right" }}>
            <div style={{ color: "var(--accent-new)" }}>● 15 On Tap</div>
            <div style={{ marginTop: 4 }}>{data.restaurant.location}</div>
          </div>
        </div>

        {/* Board body */}
        <div style={{ display: "grid", gridTemplateColumns: cats.length > 1 ? "1fr" : "1fr 1fr", gap: "36px 72px", padding: "40px 64px", height: 812, alignContent: "start", gridAutoFlow: "column", gridTemplateRows: cats.length > 1 ? "repeat(3, auto)" : "auto" }}>
          {cats.length === 1
            ? renderTwoColSection(cats[0], SectionHeader, MenuItem)
            : cats.map((c) => (
                <div key={c.id}>
                  <SectionHeader color={c.color} stars={c.stars} size="lg">{c.title}</SectionHeader>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 22 }}>
                    {c.items.slice(0, 5).map((it, i) => <MenuItem key={i} {...it} priceSize="lg" leaders={true} />)}
                  </div>
                </div>
              ))}
        </div>

        {/* Footer ticker */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 72, background: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
          <span style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: 34, color: "#fff", letterSpacing: ".04em" }}>
            ★ Live Music ★ Open Mic Nights ★ Pet Friendly Patio ★
          </span>
        </div>

        {/* Page dots (control) */}
        <div style={{ position: "absolute", top: 44, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 10 }}>
          {pages.map((_, i) => (
            <button key={i} onClick={() => { setPage(i); setAuto(false); }}
              style={{ width: 12, height: 12, borderRadius: "50%", border: "none", cursor: "pointer",
                background: i === page ? "var(--accent-price)" : "var(--border-strong)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Sandwiches page: one big header, items flowing into two columns.
function renderTwoColSection(c, SectionHeader, MenuItem) {
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <SectionHeader color={c.color} stars={c.stars} size="lg">{c.title}</SectionHeader>
      <div style={{ columnCount: 2, columnGap: 72, marginTop: 24 }}>
        {c.items.map((it, i) => (
          <div key={i} style={{ breakInside: "avoid", marginBottom: 22 }}>
            <MenuItem {...it} priceSize="lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
window.TVBoard = TVBoard;
