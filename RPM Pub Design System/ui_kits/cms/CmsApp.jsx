// RPM Menu Manager — minimal CMS for the single-restaurant menu.
// Composes DS primitives; edits live React state (mock persistence).
function CmsApp() {
  const NS = window.RPMPubDesignSystem_cc2ec6;
  const { Button, Input, Textarea, Switch, Card, Tag, PriceTag } = NS;

  // Seed editable state from the shared menu data.
  const seed = JSON.parse(JSON.stringify(window.RPM_MENU.categories)).map((c) => ({
    ...c,
    items: c.items.map((it) => ({ available: true, ...it })),
  }));
  const [cats, setCats] = React.useState(seed);
  const [activeCat, setActiveCat] = React.useState(seed[0].id);
  const [editing, setEditing] = React.useState(null); // {catId, index} | "new" | null
  const [dirty, setDirty] = React.useState(false);
  const [published, setPublished] = React.useState(true);

  const cat = cats.find((c) => c.id === activeCat);
  const markDirty = () => { setDirty(true); setPublished(false); };

  const toggleAvail = (idx) => {
    setCats((cs) => cs.map((c) => c.id !== activeCat ? c : { ...c, items: c.items.map((it, i) => i === idx ? { ...it, available: !it.available } : it) }));
    markDirty();
  };

  const draftFor = () => {
    if (editing === "new") return { name: "", price: "", description: "", available: true, tags: [] };
    if (editing) return cat.items[editing.index];
    return null;
  };
  const [draft, setDraft] = React.useState(null);
  React.useEffect(() => { setDraft(draftFor()); }, [editing]);

  const saveDraft = () => {
    setCats((cs) => cs.map((c) => {
      if (c.id !== activeCat) return c;
      if (editing === "new") return { ...c, items: [...c.items, { ...draft, price: parseFloat(draft.price) || 0 }] };
      return { ...c, items: c.items.map((it, i) => i === editing.index ? { ...draft, price: parseFloat(draft.price) || draft.price } : it) };
    }));
    markDirty(); setEditing(null);
  };
  const deleteItem = () => {
    if (editing === "new") { setEditing(null); return; }
    setCats((cs) => cs.map((c) => c.id !== activeCat ? c : { ...c, items: c.items.filter((_, i) => i !== editing.index) }));
    markDirty(); setEditing(null);
  };

  const railW = 240, drawerW = editing ? 380 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--surface-base)", fontFamily: "var(--font-body)" }}>
      {/* Top bar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 68, borderBottom: "var(--bw) solid var(--border-hairline)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-accent)", fontSize: 26, color: "var(--rpm-cream)" }}>
            <span style={{ color: "var(--accent-primary)" }}>R</span>PM
          </span>
          <span style={{ fontFamily: "var(--font-heading)", textTransform: "uppercase", letterSpacing: ".14em", fontSize: 13, color: "var(--text-muted)" }}>Menu Manager</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "var(--font-heading)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 12, color: published ? "var(--accent-new)" : "var(--accent-price)" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "currentColor", boxShadow: published ? "var(--glow-toxic)" : "none" }} />
            {published ? "Board Live" : "Unpublished changes"}
          </span>
          <Button variant="primary" disabled={published} onClick={() => { setPublished(true); setDirty(false); }}>
            Publish to Board
          </Button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left rail — categories */}
        <nav style={{ width: railW, flexShrink: 0, borderRight: "var(--bw) solid var(--border-hairline)", padding: "16px 12px", overflowY: "auto", background: "var(--surface-raised)" }}>
          <div style={{ fontFamily: "var(--font-heading)", textTransform: "uppercase", letterSpacing: ".1em", fontSize: 11, color: "var(--text-faint)", padding: "0 8px 10px" }}>Categories</div>
          {cats.map((c) => {
            const on = c.id === activeCat;
            const live = c.items.filter((i) => i.available).length;
            return (
              <button key={c.id} onClick={() => { setActiveCat(c.id); setEditing(null); }}
                style={{ width: "100%", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 8px", marginBottom: 2, borderRadius: "var(--radius-sm)", border: "none",
                  borderLeft: "3px solid " + (on ? "var(--accent-primary)" : "transparent"),
                  background: on ? "var(--surface-inset)" : "transparent",
                  fontFamily: "var(--font-heading)", fontSize: 14, fontWeight: 500,
                  color: on ? "var(--text-primary)" : "var(--text-secondary)" }}>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title.split(" · ")[0]}</span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-faint)" }}>{live}/{c.items.length}</span>
              </button>
            );
          })}
          <div style={{ padding: "12px 8px 0" }}>
            <Button variant="ghost" size="sm" fullWidth>+ Add Category</Button>
          </div>
        </nav>

        {/* Center — item list */}
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "24px 28px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", color: "var(--accent-primary)", fontSize: 40, margin: 0, lineHeight: 1 }}>{cat.title.split(" · ")[0]}</h1>
              <div style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 6 }}>{cat.items.length} items · {cat.items.filter((i) => i.available).length} on the board</div>
            </div>
            <Button variant="secondary" onClick={() => setEditing("new")}>+ Add Item</Button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cat.items.map((it, i) => {
              const isEd = editing && editing !== "new" && editing.index === i;
              return (
                <Card key={i} accent={isEd} padded={false} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", opacity: it.available ? 1 : 0.55 }}>
                  <span style={{ color: "var(--text-faint)", fontSize: 16, cursor: "grab", letterSpacing: "2px", userSelect: "none" }}>⠿</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontStyle: "italic", textTransform: "uppercase", color: "var(--accent-secondary)", fontSize: 16, textDecoration: it.available ? "none" : "line-through" }}>{it.name || "Untitled"}</span>
                      {(it.tags || []).map((t, k) => <Tag key={k} tone={t.tone}>{t.label}</Tag>)}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 520 }}>{it.description}</div>
                  </div>
                  <div style={{ minWidth: 64, textAlign: "right" }}><PriceTag price={it.price || 0} size="sm" /></div>
                  <Switch checked={it.available} onChange={() => toggleAvail(i)} />
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ catId: activeCat, index: i })}>Edit</Button>
                </Card>
              );
            })}
          </div>
        </main>

        {/* Right drawer — editor */}
        {editing && draft && (
          <aside style={{ width: drawerW, flexShrink: 0, borderLeft: "var(--bw) solid var(--border-hairline)", background: "var(--surface-raised)", padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontFamily: "var(--font-heading)", textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-primary)", fontSize: 18, margin: 0 }}>{editing === "new" ? "New Item" : "Edit Item"}</h2>
              <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <Input label="Item Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Monster Reuben" />
            <Input label="Price" prefix="$" value={String(draft.price)} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="15.99" hint="Cents render as superscript on the board" />
            <Textarea label="Description" rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Corned beef, kraut, swiss & thousand island…" />
            <div>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-muted)", marginBottom: 10 }}>Attributes</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[{ label: "New", tone: "new" }, { label: "Fan Fave", tone: "fave" }, { label: "Spicy", tone: "spicy" }, { label: "Veggie", tone: "veggie" }].map((opt) => {
                  const on = (draft.tags || []).some((t) => t.label === opt.label);
                  return (
                    <button key={opt.label} onClick={() => setDraft({ ...draft, tags: on ? draft.tags.filter((t) => t.label !== opt.label) : [...(draft.tags || []), opt] })}
                      style={{ cursor: "pointer", background: "none", border: "none", padding: 0, opacity: on ? 1 : 0.4 }}>
                      <Tag tone={opt.tone}>{opt.label}</Tag>
                    </button>
                  );
                })}
              </div>
            </div>
            <Switch checked={draft.available} onChange={(v) => setDraft({ ...draft, available: v })} label={draft.available ? "On the board" : "86'd — hidden"} />
            <div style={{ marginTop: "auto", display: "flex", gap: 10, paddingTop: 12 }}>
              <Button variant="primary" onClick={saveDraft} style={{ flex: 1 }}>{editing === "new" ? "Add Item" : "Save"}</Button>
              <Button variant="danger" onClick={deleteItem}>{editing === "new" ? "Discard" : "Delete"}</Button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
window.CmsApp = CmsApp;
