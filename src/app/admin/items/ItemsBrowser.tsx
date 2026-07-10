"use client";

// The main items board — mobile-first, one-tap availability toggle front
// and center (PRD §3.1 goal). Grouped by category, filterable by search
// (name + aliases, per §3.1's admin-search use of `aliases`) and category.
//
// It also hosts the WordPress-wp-admin-style inline bulk bar (replacing the
// old standalone /admin/items/bulk page): a checkbox per row + a "select all
// on this view" header checkbox + a "Bulk actions" <select> + Apply. Every
// bulk action runs through the exact same preview→apply, pending_changes-
// backed service path the old board used (src/lib/service/bulk-ops.ts via
// ./bulk/actions) — never a parallel write path. Availability/category/tag
// preview-then-apply in one click; price-adjust shows the old/new diff and
// waits for an explicit confirm before applying (owner-only per PRD §2).
import * as React from "react";
import Link from "next/link";
import { Card, Button, Input } from "@/components/ds";
import type { Category, Item, Tag as TagRow } from "@/db/schema";
import { formatPrice } from "@/lib/pricing";
import type { BulkChangeType } from "@/lib/service/bulk-ops";
import { AvailabilityToggle } from "./AvailabilityToggle";
import {
  previewBulkOperationAction,
  applyBulkOperationAction,
  cancelBulkPreviewAction,
  type BulkPreviewActionResult,
  type BulkApplyActionResult,
} from "./bulk/actions";
import { useRouter } from "next/navigation";

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

// The bulk-actions dropdown options, mapped to the service's discriminated
// change types. Kept flat (one option per user-facing verb) so the <select>
// reads like wp-admin's "Bulk actions" menu.
type BulkOp =
  | "set_available"
  | "set_unavailable"
  | "change_category"
  | "add_tag"
  | "remove_tag"
  | "adjust_price";

const OP_CHANGE_TYPE: Record<BulkOp, BulkChangeType> = {
  set_available: "bulk_set_availability",
  set_unavailable: "bulk_set_availability",
  change_category: "bulk_set_category",
  add_tag: "bulk_tag",
  remove_tag: "bulk_tag",
  adjust_price: "bulk_price_adjust",
};

const APPLIED_LABEL: Record<BulkChangeType, string> = {
  bulk_set_availability: "Availability change",
  bulk_set_category: "Category change",
  bulk_tag: "Tag change",
  bulk_price_adjust: "Price adjustment",
};

const selectStyle: React.CSSProperties = {
  height: "var(--tap-target)",
  background: "var(--surface-inset)",
  border: "var(--bw) solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-body)",
  padding: "0 var(--sp-3)",
};

export function ItemsBrowser({ items, categories, tags, isOwner }: ItemsBrowserProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // Bulk-bar state.
  const [op, setOp] = React.useState<BulkOp | "">("");
  const [targetCategoryId, setTargetCategoryId] = React.useState(categories[0]?.id ?? "");
  const [tagId, setTagId] = React.useState(tags[0]?.id ?? "");
  const [priceMode, setPriceMode] = React.useState<"flat" | "percent">("flat");
  const [amountDollars, setAmountDollars] = React.useState("");
  const [percent, setPercent] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [applyResult, setApplyResult] = React.useState<BulkApplyActionResult | null>(null);
  // Price-adjust confirmation: a preview is held here until the user confirms.
  const [pricePreview, setPricePreview] = React.useState<BulkPreviewActionResult | null>(null);

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

  // "Select all on this view" tracks the filtered set — checked only when
  // every currently-visible item is selected.
  const filteredIds = React.useMemo(() => filtered.map((i) => i.id), [filtered]);
  const allViewSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPricePreview(null);
  }

  function toggleSelectAllView() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allViewSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
    setPricePreview(null);
  }

  function clearBulkOutcome() {
    setError(null);
    setApplyResult(null);
    setPricePreview(null);
  }

  function buildInput(changeType: BulkChangeType, currentOp: BulkOp): Record<string, unknown> | null {
    const itemIds = Array.from(selected);
    if (itemIds.length === 0) {
      setError("Select at least one item first.");
      return null;
    }
    switch (changeType) {
      case "bulk_set_availability":
        return { changeType, itemIds, isAvailable: currentOp === "set_available" };
      case "bulk_set_category":
        if (!targetCategoryId) {
          setError("Choose a target category.");
          return null;
        }
        return { changeType, itemIds, categoryId: targetCategoryId };
      case "bulk_tag":
        if (!tagId) {
          setError("Choose a tag.");
          return null;
        }
        return { changeType, itemIds, tagId, action: currentOp === "add_tag" ? "add" : "remove" };
      case "bulk_price_adjust": {
        if (priceMode === "flat") {
          const dollars = Number(amountDollars);
          if (!Number.isFinite(dollars) || amountDollars.trim() === "") {
            setError("Enter a dollar amount (use a minus sign to decrease).");
            return null;
          }
          return { changeType, itemIds, mode: "flat", amountCents: Math.round(dollars * 100) };
        }
        const pct = Number(percent);
        if (!Number.isFinite(pct) || percent.trim() === "") {
          setError("Enter a percent (use a minus sign to decrease).");
          return null;
        }
        return { changeType, itemIds, mode: "percent", percent: pct };
      }
      default:
        return null;
    }
  }

  async function applyPending(pendingChangeId: string) {
    const result = await applyBulkOperationAction(pendingChangeId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setApplyResult(result.data);
    setSelected(new Set());
    setPricePreview(null);
    setOp("");
    router.refresh();
  }

  async function handleApply() {
    if (!op) {
      setError("Choose a bulk action first.");
      return;
    }
    clearBulkOutcome();
    const changeType = OP_CHANGE_TYPE[op];
    const input = buildInput(changeType, op);
    if (!input) return;

    setPending(true);
    const preview = await previewBulkOperationAction(input);
    if (!preview.ok) {
      setPending(false);
      setError(preview.error);
      return;
    }

    // Price adjustments show the old/new diff and wait for an explicit
    // confirm; everything else preview-then-applies in the same click.
    if (changeType === "bulk_price_adjust") {
      setPending(false);
      setPricePreview(preview.data);
      return;
    }
    await applyPending(preview.data.pendingChangeId);
    setPending(false);
  }

  async function handleConfirmPrice() {
    if (!pricePreview) return;
    setError(null);
    setPending(true);
    await applyPending(pricePreview.pendingChangeId);
    setPending(false);
  }

  async function handleCancelPrice() {
    if (!pricePreview) return;
    const id = pricePreview.pendingChangeId;
    setPricePreview(null);
    await cancelBulkPreviewAction(id);
  }

  const needsCategory = op === "change_category";
  const needsTag = op === "add_tag" || op === "remove_tag";
  const needsPrice = op === "adjust_price";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      {error && (
        <Card style={{ borderColor: "var(--accent-primary)" }}>
          <p style={{ color: "var(--accent-primary)", margin: 0, fontFamily: "var(--font-body)" }}>{error}</p>
        </Card>
      )}

      {applyResult && (
        <Card accent>
          <p style={{ margin: 0, fontFamily: "var(--font-body)", color: "var(--text-primary)" }}>
            Applied <strong>{APPLIED_LABEL[applyResult.changeType]}</strong>: {applyResult.appliedCount} item
            {applyResult.appliedCount === 1 ? "" : "s"} changed
            {applyResult.skippedCount > 0 ? `, ${applyResult.skippedCount} skipped (already up to date)` : ""}.{" "}
            <Link href="/admin/settings/audit-log" style={{ color: "var(--accent-primary)" }}>
              View in Audit Log →
            </Link>
          </p>
        </Card>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or alias…"
          style={{
            flex: "1 1 240px",
            height: "var(--tap-target)",
            background: "var(--surface-inset)",
            border: "var(--bw) solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            padding: "0 var(--sp-3)",
          }}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={selectStyle}>
          <option value="all">All categories</option>
          {sortedCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* --- Inline bulk bar (wp-admin style) --- */}
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--sp-3)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={allViewSelected}
                onChange={toggleSelectAllView}
                aria-label="Select all items on this view"
                disabled={filteredIds.length === 0}
              />
              <span style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)", fontSize: "0.8125rem" }}>
                Select all ({selected.size} selected)
              </span>
            </label>

            <select
              value={op}
              onChange={(e) => {
                setOp(e.target.value as BulkOp | "");
                clearBulkOutcome();
              }}
              style={{ ...selectStyle, flex: "0 1 200px" }}
              aria-label="Bulk actions"
            >
              <option value="">Bulk actions…</option>
              <option value="set_available">Set available</option>
              <option value="set_unavailable">Set unavailable</option>
              <option value="change_category">Change category…</option>
              <option value="add_tag">Add tag…</option>
              <option value="remove_tag">Remove tag…</option>
              {isOwner && <option value="adjust_price">Adjust price…</option>}
            </select>

            {needsCategory && (
              <select value={targetCategoryId} onChange={(e) => setTargetCategoryId(e.target.value)} style={selectStyle} aria-label="Target category">
                {sortedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {needsTag && (
              <select value={tagId} onChange={(e) => setTagId(e.target.value)} style={selectStyle} aria-label="Tag">
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon ? `${t.icon} ` : ""}
                    {t.name} {t.visibility === "private" ? "(private)" : ""}
                  </option>
                ))}
              </select>
            )}

            {needsPrice && (
              <>
                <select value={priceMode} onChange={(e) => setPriceMode(e.target.value as "flat" | "percent")} style={selectStyle} aria-label="Price mode">
                  <option value="flat">Flat $</option>
                  <option value="percent">Percent %</option>
                </select>
                {priceMode === "flat" ? (
                  <Input
                    label=""
                    prefix="$"
                    placeholder="0.50 / -0.50"
                    value={amountDollars}
                    onChange={(e) => setAmountDollars(e.target.value)}
                    style={{ maxWidth: 130 }}
                    aria-label="Dollar amount"
                  />
                ) : (
                  <Input
                    label=""
                    placeholder="10 / -10"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    style={{ maxWidth: 120 }}
                    aria-label="Percent"
                  />
                )}
              </>
            )}

            <Button size="sm" onClick={handleApply} disabled={pending || !op} type="button">
              {pending ? "Working…" : "Apply"}
            </Button>
          </div>

          {needsPrice && (
            <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.75rem", margin: 0 }}>
              Only touches fixed-price items. Ask-server/TBD items and modifier/happy-hour prices are never touched
              (addendum §5.4). You&apos;ll confirm the diff before it applies.
            </p>
          )}
        </div>
      </Card>

      {/* Price-adjust confirmation panel (diff preview + confirm). */}
      {pricePreview && (
        <Card accent>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--sp-3)" }}>
              <h2
                style={{
                  fontFamily: "var(--font-heading)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--ls-caps)",
                  fontSize: "0.9375rem",
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                Confirm price adjustment
              </h2>
              <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
                Expires at {new Date(pricePreview.expiresAt).toLocaleTimeString()}
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "var(--bw) solid var(--border-hairline)" }}>
                    <th style={{ padding: "var(--sp-2)", color: "var(--text-muted)" }}>Item</th>
                    <th style={{ padding: "var(--sp-2)", color: "var(--text-muted)" }}>Before</th>
                    <th style={{ padding: "var(--sp-2)", color: "var(--text-muted)" }}>After</th>
                  </tr>
                </thead>
                <tbody>
                  {pricePreview.diff.map((row) => (
                    <tr key={row.itemId} style={{ borderBottom: "var(--bw) solid var(--border-hairline)", opacity: row.skipped ? 0.5 : 1 }}>
                      <td style={{ padding: "var(--sp-2)", color: "var(--text-primary)" }}>{row.name}</td>
                      <td style={{ padding: "var(--sp-2)", color: "var(--text-secondary)" }}>
                        {formatPrice(row.before.priceCents as number | null) ?? "—"}
                      </td>
                      <td style={{ padding: "var(--sp-2)", color: row.skipped ? "var(--text-faint)" : "var(--accent-price)" }}>
                        {row.skipped
                          ? `Skipped — ${row.reason ?? "no change"}`
                          : formatPrice(row.after.priceCents as number | null) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <Button onClick={handleConfirmPrice} disabled={pending}>
                {pending ? "Applying…" : `Apply to ${pricePreview.diff.filter((d) => !d.skipped).length} item(s)`}
              </Button>
              <Button variant="secondary" onClick={handleCancelPrice} disabled={pending} type="button">
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

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
                <ItemRow
                  key={item.id}
                  item={item}
                  isOwner={isOwner}
                  selected={selected.has(item.id)}
                  onToggleSelect={() => toggleItem(item.id)}
                />
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
                <ItemRow
                  key={item.id}
                  item={item}
                  isOwner={isOwner}
                  selected={selected.has(item.id)}
                  onToggleSelect={() => toggleItem(item.id)}
                />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ItemRow({
  item,
  isOwner,
  selected,
  onToggleSelect,
}: {
  item: Item;
  isOwner: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const price = priceLabel(item);
  return (
    <Card
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-4)",
        padding: "var(--sp-3) var(--sp-4)",
        borderColor: selected ? "var(--accent-primary)" : undefined,
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        aria-label={`Select ${item.name}`}
        style={{ flexShrink: 0 }}
      />
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
              // "TBD" (pricingType === "tbd") is a data-quality gap, not a
              // real price -- give it the same "needs review" accent the
              // modifier-pricing flow uses (PricingResolver.tsx) so it's
              // scannable across the whole list, not the same color as a
              // confirmed price.
              color: item.pricingType === "tbd" ? "var(--status-warn)" : isOwner ? "var(--accent-price)" : "var(--text-faint)",
              fontWeight: item.pricingType === "tbd" ? 700 : undefined,
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
