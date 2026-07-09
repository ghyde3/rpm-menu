"use client";

// The main items board — mobile-first, one-tap availability toggle front
// and center (PRD §3.1 goal). Grouped by category, filterable by search
// (name + aliases, per §3.1's admin-search use of `aliases`) and category.
import * as React from "react";
import Link from "next/link";
import { Card, Button } from "@/components/ds";
import type { Category, Item, Tag as TagRow } from "@/db/schema";
import { formatPrice } from "@/lib/pricing";
import { AvailabilityToggle } from "./AvailabilityToggle";

export interface ItemsBrowserProps {
  items: Item[];
  categories: Category[];
  tags: TagRow[];
  isOwner: boolean;
}

function priceLabel(item: Item): string | null {
  if (item.pricingType === "ask_server") return "Ask your server";
  if (item.pricingType === "tbd") return "TBD";
  return formatPrice(item.priceCents);
}

export function ItemsBrowser({ items, categories, isOwner }: ItemsBrowserProps) {
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");

  const categoriesById = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const sortedCategories = React.useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.categoryId !== categoryFilter) return false;
      if (!q) return true;
      const haystack = [item.name, item.description ?? "", ...item.aliases].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search, categoryFilter]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of filtered) {
      const list = map.get(item.categoryId) ?? [];
      list.push(item);
      map.set(item.categoryId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    return map;
  }, [filtered]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or alias…"
          style={{
            flex: "1 1 240px",
            height: 44,
            background: "var(--surface-inset)",
            border: "var(--bw) solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            padding: "0 var(--sp-3)",
          }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            height: 44,
            background: "var(--surface-inset)",
            border: "var(--bw) solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            padding: "0 var(--sp-3)",
          }}
        >
          <option value="all">All categories</option>
          {sortedCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 && (
        <Card>
          <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", margin: 0 }}>
            No items yet. {categories.length === 0 ? "Add a category first, then " : ""}
            <Link href="/admin/items/new" style={{ color: "var(--accent-primary)" }}>
              create your first item
            </Link>
            .
          </p>
        </Card>
      )}

      {sortedCategories
        .filter((c) => grouped.has(c.id))
        .map((category) => (
          <section key={category.id}>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                textTransform: "uppercase",
                letterSpacing: "var(--ls-caps)",
                fontSize: "0.9375rem",
                color: "var(--text-secondary)",
                margin: "0 0 var(--sp-3)",
              }}
            >
              {category.name}
              <span style={{ color: "var(--text-faint)", fontWeight: 400, marginLeft: "var(--sp-2)" }}>
                ({grouped.get(category.id)?.length ?? 0})
              </span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              {grouped.get(category.id)!.map((item) => (
                <ItemRow key={item.id} item={item} isOwner={isOwner} />
              ))}
            </div>
          </section>
        ))}

      {filtered.length === 0 && items.length > 0 && (
        <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)" }}>No items match “{search}”.</p>
      )}

      {/* Items whose category was deleted out from under them shouldn't vanish silently. */}
      {filtered.some((i) => !categoriesById.has(i.categoryId)) && (
        <section>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              textTransform: "uppercase",
              letterSpacing: "var(--ls-caps)",
              fontSize: "0.9375rem",
              color: "var(--accent-primary)",
            }}
          >
            Uncategorized
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {filtered
              .filter((i) => !categoriesById.has(i.categoryId))
              .map((item) => (
                <ItemRow key={item.id} item={item} isOwner={isOwner} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ItemRow({ item, isOwner }: { item: Item; isOwner: boolean }) {
  const price = priceLabel(item);
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", padding: "var(--sp-3) var(--sp-4)" }}>
      <AvailabilityToggle itemId={item.id} initialAvailable={item.isAvailable} />
      <Link
        href={`/admin/items/${item.id}`}
        style={{
          flex: 1,
          minWidth: 0,
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--sp-3)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-heading)",
            color: item.isAvailable ? "var(--text-primary)" : "var(--text-faint)",
            textDecoration: item.isAvailable ? "none" : "line-through",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.name}
        </span>
        {price && (
          <span
            style={{
              fontFamily: "var(--font-heading)",
              color: isOwner ? "var(--accent-price)" : "var(--text-faint)",
              fontSize: "0.9375rem",
              flexShrink: 0,
            }}
          >
            {price}
          </span>
        )}
      </Link>
      <Link href={`/admin/items/${item.id}`}>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </Link>
    </Card>
  );
}
