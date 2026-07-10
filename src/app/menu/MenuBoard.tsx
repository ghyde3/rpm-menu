"use client";

// The public web menu's interactive shell (PRD §3.4): sticky header + search
// + category chip nav with scroll-spy, one @/components/ds MenuSection per
// category, and a venue-info footer. Modeled closely on
// "RPM Pub Design System/ui_kits/mobile_menu/MobileMenu.jsx" — the design
// system's own reference build of exactly this surface — but data-driven off
// the server-computed `PublicMenuData` (src/lib/menu/public-query.ts) instead
// of its static fixture.
//
// This is a Client Component so the search box and chip-nav scroll-spy can
// be interactive, but it renders no data of its own — everything it shows
// was fetched server-side in page.tsx (which is what keeps the route
// statically cacheable / ISR-revalidate-on-write per docs/architecture.md).
import * as React from "react";
import Image from "next/image";
import { MenuSection, MenuItem } from "@/components/ds";
import type { PublicMenuData, PublicMenuCategory, PublicMenuItem } from "@/lib/menu/public-query";
import { ItemGallery } from "./ItemGallery";

export interface MenuBoardProps {
  data: PublicMenuData;
}

function matchesQuery(item: PublicMenuItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return item.name.toLowerCase().includes(q) || (item.description ?? "").toLowerCase().includes(q);
}

/** Category header color alternates hot-rod red / flame orange down the
 * page, matching the printed board's section rhythm (SKILL.md: "SectionHeader
 * — big Anton caps board header (red/orange, optional stars)"). */
function sectionColor(index: number): string | undefined {
  return index % 2 === 0 ? undefined : "var(--accent-secondary)";
}

export function MenuBoard({ data }: MenuBoardProps) {
  const { venue, categories } = data;
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(categories[0]?.id ?? null);
  const [navOpen, setNavOpen] = React.useState(false);
  const sectionRefs = React.useRef<Record<string, HTMLElement | null>>({});

  const visibleCategories = React.useMemo(
    () =>
      categories
        .map((category) => ({ ...category, items: category.items.filter((item) => matchesQuery(item, query)) }))
        .filter((category) => category.items.length > 0),
    [categories, query],
  );

  const visibleIds = React.useMemo(() => visibleCategories.map((c) => c.id), [visibleCategories]);

  // Scroll-spy: keep the "active category" highlight in sync as the visitor
  // scrolls, not just on click. The rootMargin pins the trigger line just
  // below the sticky header so a section lights up as its heading reaches the
  // top band of the viewport; the topmost intersecting section wins.
  React.useEffect(() => {
    if (visibleIds.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-category-id");
          if (!id) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const topmost = visibleIds.find((id) => visible.has(id));
        if (topmost) setActive(topmost);
      },
      { rootMargin: "-180px 0px -60% 0px", threshold: 0 },
    );
    for (const id of visibleIds) {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [visibleIds]);

  function scrollToCategory(id: string) {
    setActive(id);
    setNavOpen(false);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      style={{
        ...(venue.cssVars as React.CSSProperties),
        minHeight: "100vh",
        background: "var(--board-wash)",
        position: "relative",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--grain)",
          backgroundSize: "var(--grain-size)",
          opacity: 0.6,
          pointerEvents: "none",
        }}
      />

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 3,
          padding: "var(--sp-5) var(--sp-5) var(--sp-3)",
          borderBottom: "var(--bw) solid var(--border-hairline)",
          background: "rgba(18,17,16,.85)",
          backdropFilter: "blur(6px)",
        }}
      >
        {/* Exactly one real <h1> for SEO/accessibility (§3.4 "SEO basics:
            proper headings") — visually hidden because the board's actual
            visual masthead is the wordmark/logo just below, and a second
            large caption would clutter the printed-board look. */}
        <h1
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {venue.name} Menu
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          {venue.logoUrl ? (
            <Image
              src={venue.logoUrl}
              alt={`${venue.name} logo`}
              width={40}
              height={40}
              style={{ borderRadius: "var(--radius-sm)", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontFamily: "var(--font-accent)", fontSize: 28, color: "var(--rpm-cream, var(--text-primary))", lineHeight: 1 }}>
              <span style={{ color: "var(--accent-primary)" }}>{venue.name.charAt(0)}</span>
              {venue.name.slice(1)}
            </span>
          )}
        </div>

        <div style={{ marginTop: "var(--sp-4)", display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Browse menu categories"
            aria-haspopup="dialog"
            aria-expanded={navOpen}
            aria-controls="menu-category-drawer"
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "var(--tap-target)",
              height: "var(--tap-target)",
              fontSize: 20,
              lineHeight: 1,
              cursor: "pointer",
              color: "var(--text-primary)",
              background: "var(--surface-inset)",
              border: "var(--bw) solid var(--border-strong)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span aria-hidden="true">☰</span>
          </button>

          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-2)",
              background: "var(--surface-inset)",
              border: "var(--bw) solid var(--border-strong)",
              borderRadius: "var(--radius-sm)",
              padding: "0 var(--sp-3)",
              height: "var(--tap-target)",
            }}
          >
            <span aria-hidden="true" style={{ color: "var(--text-faint)", fontSize: 14 }}>
              ⌕
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the board…"
              aria-label="Search the menu"
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--fs-body-sm)",
              }}
            />
          </div>
        </div>
      </header>

      <CategoryDrawer
        open={navOpen}
        categories={visibleCategories}
        active={active}
        onSelect={scrollToCategory}
        onClose={() => setNavOpen(false)}
      />

      <main
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "var(--container-mobile)",
          margin: "0 auto",
          padding: "var(--sp-5) var(--sp-5) var(--sp-8)",
        }}
      >
        {visibleCategories.length === 0 && (
          <p
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--text-muted)",
              textAlign: "center",
              marginTop: "var(--sp-8)",
            }}
          >
            Nothing on the board matches &ldquo;{query}&rdquo;.
          </p>
        )}

        {visibleCategories.map((category, index) => (
          <CategorySection
            key={category.id}
            category={category}
            color={sectionColor(index)}
            registerRef={(el) => {
              sectionRefs.current[category.id] = el;
            }}
          />
        ))}

        <MenuFooter venue={venue} />
      </main>
    </div>
  );
}

/** Slide-in category drawer (mobile-polish M5). A hamburger in the sticky
 * header opens it; tapping a category smooth-scrolls to that section and
 * closes the drawer, and the scroll-spy `active` highlight is mirrored here.
 * Accessible: role="dialog" + aria-modal, focus moves in on open and returns
 * to the opener on close, Escape and a backdrop click close it, and
 * background scroll is locked while open. */
function CategoryDrawer({
  open,
  categories,
  active,
  onSelect,
  onClose,
}: {
  open: boolean;
  categories: PublicMenuCategory[];
  active: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const firstItemRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    firstItemRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        // Minimal focus trap: keep Tab inside the panel's controls.
        const focusables = panelRef.current?.querySelectorAll<HTMLElement>("button");
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "rgba(9,8,7,0.6)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        id="menu-category-drawer"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu categories"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: "min(78vw, 20rem)",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-raised)",
          borderRight: "var(--bw) solid var(--border-strong)",
          boxShadow: "var(--shadow-lift)",
          padding: "var(--sp-5) var(--sp-4)",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--sp-4)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "var(--ls-caps)",
              fontSize: "var(--fs-caption)",
              color: "var(--accent-secondary)",
            }}
          >
            Categories
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close categories"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "var(--tap-target)",
              height: "var(--tap-target)",
              fontSize: "1.5rem",
              lineHeight: 1,
              cursor: "pointer",
              color: "var(--text-primary)",
              background: "var(--surface-inset)",
              border: "var(--bw) solid var(--border-strong)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            ×
          </button>
        </div>

        <nav aria-label="Menu categories" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          {categories.map((category, i) => (
            <button
              key={category.id}
              ref={i === 0 ? firstItemRef : undefined}
              type="button"
              onClick={() => onSelect(category.id)}
              aria-current={active === category.id ? "true" : undefined}
              style={{
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: "var(--fs-body-sm)",
                textTransform: "uppercase",
                letterSpacing: "var(--ls-caps)",
                padding: "var(--sp-3) var(--sp-3)",
                borderRadius: "var(--radius-sm)",
                border: `var(--bw) solid ${active === category.id ? "var(--accent-primary)" : "var(--border-strong)"}`,
                background: active === category.id ? "var(--accent-primary)" : "transparent",
                color: active === category.id ? "#fff" : "var(--text-secondary)",
                transition: "all var(--dur) var(--ease)",
              }}
            >
              {category.name}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  color,
  registerRef,
}: {
  category: PublicMenuCategory;
  color?: string;
  registerRef: (el: HTMLElement | null) => void;
}) {
  return (
    <section
      ref={registerRef}
      data-category-id={category.id}
      style={{ paddingTop: "var(--sp-7)", scrollMarginTop: 180 }}
    >
      {category.imageUrl && (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 7",
            marginBottom: "var(--sp-4)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            border: "var(--bw-hair) solid var(--border-hairline)",
          }}
        >
          <Image
            src={category.imageUrl}
            alt={category.name}
            fill
            sizes="(max-width: 500px) 100vw, 420px"
            style={{ objectFit: "cover" }}
          />
        </div>
      )}
      {/* headerSize="md" (fs-h3) matches the design system's own MobileMenu
          reference — the default "lg" (fs-h2, 48px) Anton caps overrun the
          ~375px phone viewport (long section names like "SANDWICHES" bleed
          their trailing star off-screen). Public-menu-only; the TV board
          templates keep their large "xl" headers untouched. */}
      <MenuSection
        title={category.name}
        color={color}
        stars
        intro={category.tagline ?? undefined}
        headerSize="md"
      >
        {category.items.map((item) => (
          <MenuBoardItem key={item.id} item={item} />
        ))}
      </MenuSection>
    </section>
  );
}

function MenuBoardItem({ item }: { item: PublicMenuItem }) {
  const tags = [
    ...(item.featuredLabel ? [{ label: item.featuredLabel, tone: "fave" as const }] : []),
    ...item.tags.map((t) => ({ label: t.label, tone: t.tone })),
  ];
  // attributeLine (e.g. "5.4% ABV · IBU 38") and note (a "Half 8.29"-style
  // price-variant list, or "Ask your server") are two independent display-
  // line concerns (src/lib/menu/display-line.ts vs this module's pricing
  // resolution) — MenuItem has a single `note` slot, so combine them.
  const note = [item.attributeLine, item.note].filter(Boolean).join(" · ") || undefined;

  const row = (
    <MenuItem
      name={item.name}
      description={item.description ?? undefined}
      price={item.price}
      note={note}
      tags={tags}
      available={item.isAvailable}
      wrap
    />
  );

  // Items with no photos render exactly as before this gallery feature
  // existed — no empty box, no layout shift.
  if (!item.imageUrl) return row;

  return (
    <div style={{ display: "flex", gap: "var(--sp-4)" }}>
      <ItemGallery
        heroUrl={item.imageUrl}
        heroDisplayUrl={item.imageDisplayUrl}
        photos={item.gallery}
        itemName={item.name}
      />
      <div style={{ flex: 1, minWidth: 0 }}>{row}</div>
    </div>
  );
}

const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const WEEK_DAY_LABELS: Record<(typeof WEEK_DAYS)[number], string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function formatDayHours(day: PublicMenuData["venue"]["hours"][string]): string | null {
  if (!day) return null;
  if (day.closed) return "Closed";
  if (!day.open && !day.close) return null;
  return [day.open, day.close].filter(Boolean).join(" – ");
}

function MenuFooter({ venue }: { venue: PublicMenuData["venue"] }) {
  const socialEntries = Object.entries(venue.social).filter(([, v]) => Boolean(v));
  const hoursRows = WEEK_DAYS.map((day) => ({ day, text: formatDayHours(venue.hours[day]) })).filter(
    (row): row is { day: (typeof WEEK_DAYS)[number]; text: string } => row.text !== null,
  );

  if (!venue.address && !venue.phone && socialEntries.length === 0 && hoursRows.length === 0) return null;

  return (
    <footer
      style={{
        marginTop: "var(--sp-8)",
        paddingTop: "var(--sp-5)",
        borderTop: "var(--bw) solid var(--border-hairline)",
        textAlign: "center",
        fontFamily: "var(--font-body)",
        fontSize: "var(--fs-body-sm)",
        color: "var(--text-muted)",
      }}
    >
      {venue.address && <p style={{ margin: 0 }}>{venue.address}</p>}
      {venue.phone && <p style={{ margin: "var(--sp-1) 0 0" }}>{venue.phone}</p>}
      {hoursRows.length > 0 && (
        <dl
          style={{
            margin: "var(--sp-3) 0 0",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 var(--sp-3)",
            fontSize: "var(--fs-caption)",
          }}
        >
          {hoursRows.map(({ day, text }) => (
            <div key={day} style={{ display: "flex", gap: "0.35em" }}>
              <dt style={{ fontFamily: "var(--font-heading)", color: "var(--text-secondary)" }}>
                {WEEK_DAY_LABELS[day]}
              </dt>
              <dd style={{ margin: 0 }}>{text}</dd>
            </div>
          ))}
        </dl>
      )}
      {socialEntries.length > 0 && (
        <p style={{ margin: "var(--sp-3) 0 0" }}>
          {socialEntries.map(([platform, handle], i) => (
            <React.Fragment key={platform}>
              {i > 0 && " · "}
              <span>{handle}</span>
            </React.Fragment>
          ))}
        </p>
      )}
      <p
        style={{
          marginTop: "var(--sp-5)",
          fontFamily: "var(--font-heading)",
          textTransform: "uppercase",
          letterSpacing: "var(--ls-wide)",
          fontSize: "0.6875rem",
          color: "var(--accent-primary)",
        }}
      >
        ★ {venue.name} ★
      </p>
    </footer>
  );
}
