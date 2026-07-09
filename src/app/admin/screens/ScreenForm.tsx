"use client";

// Core screen fields — name/template/source-mode, plus every §3.2
// `display_options` density knob (title/accent/font-scale/columns,
// per-surface show toggles, overflow pagination interval, and the addendum
// §2 happy-hour price flag). Shared by the create page and the edit page,
// mirroring src/app/admin/items/ItemForm.tsx's isEdit pattern. Owner-only —
// PRD §2: staff "cannot ... manage screens" — this component is only ever
// reachable from pages that already gate on `isOwner` (see page.tsx files),
// but the service layer is the real enforcement point regardless.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ds";
import type { ScreenTemplate, ScreenSourceMode } from "@/db/schema";
import type { Screen } from "@/lib/service/screens";
import type { ScreenDisplayOptionsInput } from "@/lib/validation/screens";
import { createScreenAction, updateScreenAction } from "./actions";

export interface ScreenFormProps {
  screen?: Screen;
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

/** `undefined` | `true` | `false` as a 3-option select — "Category default"
 * lets a screen's per-surface toggle fall back to the category's own
 * `display_config` (§3.1) instead of forcing an override. */
function TriStateSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  const raw = value === undefined ? "default" : value ? "show" : "hide";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
      <label style={labelStyle}>{label}</label>
      <select
        value={raw}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "default" ? undefined : v === "show");
        }}
        style={{ ...selectStyle, minWidth: 160 }}
      >
        <option value="default">Category default</option>
        <option value="show">Show</option>
        <option value="hide">Hide</option>
      </select>
    </div>
  );
}

export function ScreenForm({ screen }: ScreenFormProps) {
  const router = useRouter();
  const isEdit = Boolean(screen);
  const opts = screen?.displayOptions ?? {};

  const [name, setName] = React.useState(screen?.name ?? "");
  const [template, setTemplate] = React.useState<ScreenTemplate>(screen?.template ?? "list");
  const [sourceMode, setSourceMode] = React.useState<ScreenSourceMode>(screen?.sourceMode ?? "query");

  const [title, setTitle] = React.useState(opts.title ?? "");
  const [accentColor, setAccentColor] = React.useState(opts.accentColor ?? "");
  const [columns, setColumns] = React.useState(opts.columns ?? 2);
  const [fontScale, setFontScale] = React.useState(opts.fontScale ?? 1);
  const [showDescriptions, setShowDescriptions] = React.useState<boolean | undefined>(opts.showDescriptions);
  const [showBadges, setShowBadges] = React.useState<boolean | undefined>(opts.showBadges);
  const [showAttributes, setShowAttributes] = React.useState<boolean | undefined>(opts.showAttributes);
  const [unavailableTreatment, setUnavailableTreatment] = React.useState<"hide" | "badge">(
    opts.unavailableTreatment ?? "hide",
  );
  const [paginationIntervalSeconds, setPaginationIntervalSeconds] = React.useState(
    opts.paginationIntervalSeconds ?? 12,
  );
  const [priceMode, setPriceMode] = React.useState<"standard" | "happy_hour">(opts.priceMode ?? "standard");

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    // Full-replace: this is always the COMPLETE displayOptions object, not a
    // partial patch (see validation/screens.ts's header comment on why a
    // partial `displayOptions` would silently reset unspecified knobs).
    const displayOptions: ScreenDisplayOptionsInput = {
      title: title.trim() || undefined,
      accentColor: accentColor.trim() || undefined,
      columns,
      fontScale,
      showDescriptions,
      showBadges,
      showAttributes,
      unavailableTreatment,
      paginationIntervalSeconds,
      priceMode,
    };

    if (isEdit && screen) {
      const result = await updateScreenAction(screen.id, { name: name.trim(), template, sourceMode, displayOptions });
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } else {
      const result = await createScreenAction({ name: name.trim(), template, sourceMode, displayOptions });
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/admin/screens/${result.data.id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      {error && (
        <Card style={{ borderColor: "var(--accent-primary)" }}>
          <p style={{ color: "var(--accent-primary)", margin: 0, fontFamily: "var(--font-body)" }}>{error}</p>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)" }}>
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ minWidth: 240, flex: 1 }}
              required
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              <label style={labelStyle}>Layout template</label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as ScreenTemplate)}
                style={{ ...selectStyle, minWidth: 160 }}
              >
                <option value="list">List — dense, text</option>
                <option value="grid">Grid — 2-3 cols, images</option>
                <option value="spotlight">Spotlight — 1-4 featured</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              <label style={labelStyle}>Content source</label>
              <select
                value={sourceMode}
                onChange={(e) => setSourceMode(e.target.value as ScreenSourceMode)}
                style={{ ...selectStyle, minWidth: 160 }}
              >
                <option value="query">Query — auto (tags/categories)</option>
                <option value="manual">Manual — curated item list</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 style={{ ...labelStyle, fontSize: "0.875rem", marginBottom: "var(--sp-3)" }}>Display options</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)" }}>
          <Input
            label="Title override"
            hint="Defaults to the screen name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ minWidth: 200 }}
          />
          <Input
            label="Accent color"
            hint="CSS color or var(--...) token"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            style={{ width: 200 }}
          />
          <Input
            label="Grid columns"
            type="number"
            min={1}
            max={4}
            value={columns}
            onChange={(e) => setColumns(Number(e.target.value))}
            style={{ width: 120 }}
          />
          <Input
            label="Font scale"
            type="number"
            step="0.05"
            min={0.5}
            max={1.5}
            value={fontScale}
            onChange={(e) => setFontScale(Number(e.target.value))}
            hint="Manual density knob (1 = normal)"
            style={{ width: 140 }}
          />
          <Input
            label="Pagination interval (s)"
            type="number"
            min={3}
            max={120}
            value={paginationIntervalSeconds}
            onChange={(e) => setPaginationIntervalSeconds(Number(e.target.value))}
            hint="Overflow rotation, default 12s"
            style={{ width: 180 }}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)", marginTop: "var(--sp-4)" }}>
          <TriStateSelect label="Descriptions" value={showDescriptions} onChange={setShowDescriptions} />
          <TriStateSelect label="Badges" value={showBadges} onChange={setShowBadges} />
          <TriStateSelect label="Attributes" value={showAttributes} onChange={setShowAttributes} />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            <label style={labelStyle}>Unavailable items</label>
            <select
              value={unavailableTreatment}
              onChange={(e) => setUnavailableTreatment(e.target.value as "hide" | "badge")}
              style={{ ...selectStyle, minWidth: 160 }}
            >
              <option value="hide">Hide entirely</option>
              <option value="badge">Show, 86&apos;d</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            <label style={labelStyle}>Price mode</label>
            <select
              value={priceMode}
              onChange={(e) => setPriceMode(e.target.value as "standard" | "happy_hour")}
              style={{ ...selectStyle, minWidth: 160 }}
            >
              <option value="standard">Standard</option>
              <option value="happy_hour">Happy hour</option>
            </select>
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--sp-3)" }}>
        {saved && (
          <span style={{ color: "var(--accent-new)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
            Saved
          </span>
        )}
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Screen"}
        </Button>
      </div>
    </form>
  );
}
