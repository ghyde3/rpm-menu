"use client";

// Multi-select bulk board (PRD §3.1 "Bulk operations (admin UI)"): select
// items -> choose an operation -> Preview (dry run, shows an old/new diff)
// -> Apply. Preview/Apply is the same pending_changes-backed code path a
// Phase 2 chat confirmation will reuse (§3.1/§4.1) -- this component is just
// a thin form over `previewBulkOperationAction` / `applyBulkOperationAction`.
import * as React from "react";
import Link from "next/link";
import { Card, Button, Input } from "@/components/ds";
import type { Category, Item, Tag as TagRow } from "@/db/schema";
import { formatPrice } from "@/lib/pricing";
import type { BulkChangeType } from "@/lib/service/bulk-ops";
import {
  previewBulkOperationAction,
  applyBulkOperationAction,
  cancelBulkPreviewAction,
  type BulkPreviewActionResult,
  type BulkApplyActionResult,
} from "./actions";

export interface BulkOpsBoardProps {
  items: Item[];
  categories: Category[];
  tags: TagRow[];
  isOwner: boolean;
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  color: "var(--text-muted)",
};

const selectStyle: React.CSSProperties = {
  height: 44,
  background: "var(--surface-inset)",
  border: "var(--bw) solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-body)",
  padding: "0 var(--sp-3)",
};

type OpKind = BulkChangeType;

const OP_LABELS: Record<OpKind, string> = {
  bulk_set_availability: "Set availability",
  bulk_set_category: "Change category",
  bulk_tag: "Add / remove tag",
  bulk_price_adjust: "Adjust price",
};

export function BulkOpsBoard({ items, categories, tags, isOwner }: BulkOpsBoardProps) {
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const [opKind, setOpKind] = React.useState<OpKind>("bulk_set_availability");
  const [targetAvailable, setTargetAvailable] = React.useState(false);
  const [targetCategoryId, setTargetCategoryId] = React.useState(categories[0]?.id ?? "");
  const [tagId, setTagId] = React.useState(tags[0]?.id ?? "");
  const [tagAction, setTagAction] = React.useState<"add" | "remove">("add");
  const [priceMode, setPriceMode] = React.useState<"flat" | "percent">("flat");
  const [amountDollars, setAmountDollars] = React.useState("");
  const [percent, setPercent] = React.useState("");

  const [preview, setPreview] = React.useState<BulkPreviewActionResult | null>(null);
  const [applyResult, setApplyResult] = React.useState<BulkApplyActionResult | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const categoriesById = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const sortedCategories = React.useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => (categoryFilter === "all" ? true : item.categoryId === categoryFilter))
      .filter((item) => (q ? [item.name, ...item.aliases].join(" ").toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search, categoryFilter]);

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => new Set([...prev, ...filtered.map((i) => i.id)]));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function resetOutcome() {
    setError(null);
    setApplyResult(null);
  }

  function buildInput(): Record<string, unknown> | null {
    const itemIds = Array.from(selected);
    if (itemIds.length === 0) {
      setError("Select at least one item first.");
      return null;
    }
    switch (opKind) {
      case "bulk_set_availability":
        return { changeType: opKind, itemIds, isAvailable: targetAvailable };
      case "bulk_set_category":
        if (!targetCategoryId) {
          setError("Choose a target category.");
          return null;
        }
        return { changeType: opKind, itemIds, categoryId: targetCategoryId };
      case "bulk_tag":
        if (!tagId) {
          setError("Choose a tag.");
          return null;
        }
        return { changeType: opKind, itemIds, tagId, action: tagAction };
      case "bulk_price_adjust": {
        if (priceMode === "flat") {
          const dollars = Number(amountDollars);
          if (!Number.isFinite(dollars) || amountDollars.trim() === "") {
            setError("Enter a dollar amount (use a minus sign to decrease).");
            return null;
          }
          return { changeType: opKind, itemIds, mode: "flat", amountCents: Math.round(dollars * 100) };
        }
        const pct = Number(percent);
        if (!Number.isFinite(pct) || percent.trim() === "") {
          setError("Enter a percent (use a minus sign to decrease).");
          return null;
        }
        return { changeType: opKind, itemIds, mode: "percent", percent: pct };
      }
    }
  }

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    resetOutcome();
    const input = buildInput();
    if (!input) return;
    setPending(true);
    const result = await previewBulkOperationAction(input);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreview(result.data);
  }

  async function handleApply() {
    if (!preview) return;
    resetOutcome();
    setPending(true);
    const result = await applyBulkOperationAction(preview.pendingChangeId);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setApplyResult(result.data);
    setPreview(null);
    setSelected(new Set());
  }

  async function handleCancelPreview() {
    if (!preview) return;
    await cancelBulkPreviewAction(preview.pendingChangeId);
    setPreview(null);
  }

  const availableOps: OpKind[] = isOwner
    ? ["bulk_set_availability", "bulk_set_category", "bulk_tag", "bulk_price_adjust"]
    : ["bulk_set_availability", "bulk_set_category", "bulk_tag"];

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
            Applied <strong>{OP_LABELS[applyResult.changeType]}</strong>: {applyResult.appliedCount} item
            {applyResult.appliedCount === 1 ? "" : "s"} changed
            {applyResult.skippedCount > 0 ? `, ${applyResult.skippedCount} skipped (already up to date)` : ""}.{" "}
            <Link
              href="/admin/changes"
              style={{ color: "var(--accent-primary)" }}
            >
              View in Recent Changes →
            </Link>
          </p>
        </Card>
      )}

      {/* --- Step 1: select items --- */}
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--sp-3)" }}>
            <h2 style={{ ...labelStyle, fontSize: "0.9375rem", margin: 0 }}>1. Select items ({selected.size} selected)</h2>
            <div style={{ display: "flex", gap: "var(--sp-2)" }}>
              <Button variant="secondary" size="sm" onClick={selectAllFiltered} type="button">
                Select all shown
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection} type="button">
                Clear
              </Button>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or alias…"
              style={{ ...selectStyle, flex: "1 1 220px" }}
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

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-1)",
              maxHeight: 360,
              overflowY: "auto",
              border: "var(--bw) solid var(--border-hairline)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--sp-2)",
            }}
          >
            {filtered.length === 0 && (
              <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", margin: "var(--sp-2)" }}>
                No items match.
              </p>
            )}
            {filtered.map((item) => {
              const category = categoriesById.get(item.categoryId);
              const checked = selected.has(item.id);
              return (
                <label
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--sp-3)",
                    padding: "var(--sp-2) var(--sp-3)",
                    borderRadius: "var(--radius-sm)",
                    background: checked ? "var(--surface-hover)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleItem(item.id)} />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontFamily: "var(--font-body)",
                      color: item.isAvailable ? "var(--text-primary)" : "var(--text-faint)",
                      textDecoration: item.isAvailable ? "none" : "line-through",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.name}
                  </span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--text-faint)", flexShrink: 0 }}>
                    {category?.name ?? "Uncategorized"}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </Card>

      {/* --- Step 2: choose operation --- */}
      <Card>
        <form onSubmit={handlePreview} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <h2 style={{ ...labelStyle, fontSize: "0.9375rem", margin: 0 }}>2. Choose an operation</h2>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
            {availableOps.map((op) => (
              <Button
                key={op}
                type="button"
                size="sm"
                variant={opKind === op ? "primary" : "secondary"}
                onClick={() => {
                  setOpKind(op);
                  setPreview(null);
                  resetOutcome();
                }}
              >
                {OP_LABELS[op]}
              </Button>
            ))}
          </div>
          {!isOwner && (
            <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", margin: 0 }}>
              Price adjustments are owner-only (PRD §2) -- ask an owner to run a bulk price change.
            </p>
          )}

          {opKind === "bulk_set_availability" && (
            <div style={{ display: "flex", gap: "var(--sp-2)" }}>
              <Button type="button" size="sm" variant={targetAvailable ? "primary" : "secondary"} onClick={() => setTargetAvailable(true)}>
                Mark available
              </Button>
              <Button type="button" size="sm" variant={!targetAvailable ? "primary" : "secondary"} onClick={() => setTargetAvailable(false)}>
                86 (mark unavailable)
              </Button>
            </div>
          )}

          {opKind === "bulk_set_category" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", maxWidth: 320 }}>
              <label style={labelStyle}>Move to category</label>
              <select value={targetCategoryId} onChange={(e) => setTargetCategoryId(e.target.value)} style={selectStyle}>
                {sortedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {opKind === "bulk_tag" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", minWidth: 220 }}>
                <label style={labelStyle}>Tag</label>
                <select value={tagId} onChange={(e) => setTagId(e.target.value)} style={selectStyle}>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icon ? `${t.icon} ` : ""}
                      {t.name} {t.visibility === "private" ? "(private)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "flex-end" }}>
                <Button type="button" size="sm" variant={tagAction === "add" ? "primary" : "secondary"} onClick={() => setTagAction("add")}>
                  Add tag
                </Button>
                <Button type="button" size="sm" variant={tagAction === "remove" ? "primary" : "secondary"} onClick={() => setTagAction("remove")}>
                  Remove tag
                </Button>
              </div>
            </div>
          )}

          {opKind === "bulk_price_adjust" && isOwner && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)", alignItems: "flex-end" }}>
              <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                <Button type="button" size="sm" variant={priceMode === "flat" ? "primary" : "secondary"} onClick={() => setPriceMode("flat")}>
                  Flat $
                </Button>
                <Button type="button" size="sm" variant={priceMode === "percent" ? "primary" : "secondary"} onClick={() => setPriceMode("percent")}>
                  Percent %
                </Button>
              </div>
              {priceMode === "flat" ? (
                <Input
                  label="Amount"
                  hint="e.g. 0.50 to raise 50¢, -0.50 to lower 50¢"
                  prefix="$"
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                  style={{ maxWidth: 200 }}
                />
              ) : (
                <Input
                  label="Percent"
                  hint="e.g. 10 to raise 10%, -10 to lower 10%"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  style={{ maxWidth: 200 }}
                />
              )}
              <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.75rem", margin: 0 }}>
                Only touches fixed-price items. Ask-server/TBD items and modifier/happy-hour prices are never touched
                (addendum §5.4).
              </p>
            </div>
          )}

          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Building preview…" : "Preview changes"}
            </Button>
          </div>
        </form>
      </Card>

      {/* --- Step 3: preview + apply --- */}
      {preview && (
        <Card accent>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--sp-3)" }}>
              <h2 style={{ ...labelStyle, fontSize: "0.9375rem", margin: 0 }}>
                3. Preview -- {OP_LABELS[preview.changeType]}
              </h2>
              <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
                Expires at {new Date(preview.expiresAt).toLocaleTimeString()}
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
                  {preview.diff.map((row) => (
                    <tr key={row.itemId} style={{ borderBottom: "var(--bw) solid var(--border-hairline)", opacity: row.skipped ? 0.5 : 1 }}>
                      <td style={{ padding: "var(--sp-2)", color: "var(--text-primary)" }}>{row.name}</td>
                      <td style={{ padding: "var(--sp-2)", color: "var(--text-secondary)" }}>
                        {formatDiffValue(preview.changeType, row.before, categoriesById)}
                      </td>
                      <td style={{ padding: "var(--sp-2)", color: row.skipped ? "var(--text-faint)" : "var(--accent-price)" }}>
                        {row.skipped
                          ? `Skipped — ${row.reason ?? "no change"}`
                          : formatDiffValue(preview.changeType, row.after, categoriesById)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <Button onClick={handleApply} disabled={pending}>
                {pending ? "Applying…" : `Apply to ${preview.diff.filter((d) => !d.skipped).length} item(s)`}
              </Button>
              <Button variant="secondary" onClick={handleCancelPreview} disabled={pending} type="button">
                Cancel preview
              </Button>
            </div>
          </div>
        </Card>
      )}

      {items.length === 0 && (
        <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)" }}>
          No items yet -- add some from the <Link href="/admin/items" style={{ color: "var(--accent-primary)" }}>Items</Link> page first.
        </p>
      )}
    </div>
  );
}

function formatDiffValue(
  changeType: BulkChangeType,
  value: Record<string, unknown>,
  categoriesById: Map<string, Category>,
): string {
  switch (changeType) {
    case "bulk_set_availability":
      return value.isAvailable ? "Available" : "86'd";
    case "bulk_set_category": {
      const id = value.categoryId;
      if (typeof id !== "string") return "—";
      return categoriesById.get(id)?.name ?? id;
    }
    case "bulk_tag":
      return value.hasTag ? "Has tag" : "No tag";
    case "bulk_price_adjust": {
      const cents = value.priceCents;
      return typeof cents === "number" ? (formatPrice(cents) ?? "—") : "—";
    }
    default:
      return "—";
  }
}
