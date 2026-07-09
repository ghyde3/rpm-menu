"use client";

// Settings > Venue (§3.8): name/logo/address/phone/social/hours, timezone
// (with a change-impact warning per §3.2a before committing), currency/price
// formatting. Styled with design-system tokens/components only.
import * as React from "react";
import { Button, Card, Input, Switch, Textarea } from "@/components/ds";
import {
  previewTimezoneChangeAction,
  updateVenueSettingsAction,
  type ActionResult,
} from "./actions";
import type {
  TimezoneChangeImpact,
  VenueSettingsRow,
} from "@/lib/service/settings/venue";

const DAYS: { key: string; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

interface DayHours {
  open?: string;
  close?: string;
  closed?: boolean;
}

interface FormState {
  name: string;
  address: string;
  phone: string;
  logoImageId: string;
  website: string;
  instagram: string;
  facebook: string;
  twitter: string;
  hours: Record<string, DayHours>;
  timezone: string;
  currencySymbol: string;
  showTrailingZerosWeb: boolean;
  showTrailingZerosDisplay: boolean;
}

function toFormState(settings: VenueSettingsRow): FormState {
  return {
    name: settings.name ?? "",
    address: settings.address ?? "",
    phone: settings.phone ?? "",
    logoImageId: settings.logoImageId ?? "",
    website: settings.social?.website ?? "",
    instagram: settings.social?.instagram ?? "",
    facebook: settings.social?.facebook ?? "",
    twitter: settings.social?.twitter ?? "",
    hours: (settings.hours as Record<string, DayHours>) ?? {},
    timezone: settings.timezone,
    currencySymbol: settings.currencyFormat?.symbol ?? "$",
    showTrailingZerosWeb: settings.currencyFormat?.showTrailingZeros?.web ?? true,
    showTrailingZerosDisplay: settings.currencyFormat?.showTrailingZeros?.display ?? true,
  };
}

/** Not memoized: cheap, and the try/catch shape here doesn't survive the
 * React Compiler's manual-memoization-preservation check when wrapped in
 * `useMemo` directly inside the component. */
function getTimezoneOptions(): string[] {
  try {
    return (
      (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? []
    );
  } catch {
    return [];
  }
}

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  fontSize: "0.9375rem",
  color: "var(--text-primary)",
  margin: "0 0 var(--sp-4) 0",
};

export function VenueSettingsForm({ initialSettings }: { initialSettings: VenueSettingsRow }) {
  const [form, setForm] = React.useState<FormState>(() => toFormState(initialSettings));
  const [savedTimezone, setSavedTimezone] = React.useState(initialSettings.timezone);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [impact, setImpact] = React.useState<TimezoneChangeImpact | null>(null);
  const [checkingImpact, setCheckingImpact] = React.useState(false);

  const tzOptions = getTimezoneOptions();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setDay(day: string, patch: Partial<DayHours>) {
    setForm((prev) => ({
      ...prev,
      hours: { ...prev.hours, [day]: { ...prev.hours[day], ...patch } },
    }));
  }

  function buildPayload() {
    return {
      name: form.name,
      address: form.address || null,
      phone: form.phone || null,
      logoImageId: form.logoImageId || null,
      social: {
        website: form.website || undefined,
        instagram: form.instagram || undefined,
        facebook: form.facebook || undefined,
        twitter: form.twitter || undefined,
      },
      hours: form.hours,
      timezone: form.timezone,
      currencyFormat: {
        symbol: form.currencySymbol || "$",
        showTrailingZeros: { web: form.showTrailingZerosWeb, display: form.showTrailingZerosDisplay },
      },
    };
  }

  function handleResult(result: ActionResult<VenueSettingsRow>) {
    if (result.ok) {
      setSavedTimezone(result.data.timezone);
      setMessage({ kind: "success", text: "Venue settings saved." });
    } else {
      setMessage({ kind: "error", text: result.error });
    }
  }

  async function handleSaveClick() {
    setMessage(null);
    if (form.timezone !== savedTimezone) {
      setCheckingImpact(true);
      const preview = await previewTimezoneChangeAction(form.timezone);
      setCheckingImpact(false);
      if (!preview.ok) {
        setMessage({ kind: "error", text: preview.error });
        return;
      }
      setImpact(preview.data);
      return; // wait for explicit confirm below
    }
    setSaving(true);
    const result = await updateVenueSettingsAction(buildPayload());
    setSaving(false);
    handleResult(result);
  }

  async function handleConfirmTimezoneChange() {
    setImpact(null);
    setSaving(true);
    const result = await updateVenueSettingsAction(buildPayload());
    setSaving(false);
    handleResult(result);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", maxWidth: 720 }}>
      <Card>
        <h2 style={sectionTitleStyle}>Basics</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <Input label="Venue Name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <Textarea
            label="Address"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            rows={2}
          />
          <Input label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          <Input
            label="Logo Image ID (advanced)"
            value={form.logoImageId}
            onChange={(e) => set("logoImageId", e.target.value)}
            hint="Uploading a logo needs the image pipeline (§3.1a), which isn't wired into this tab yet — paste an existing images.id if you have one."
          />
        </div>
      </Card>

      <Card>
        <h2 style={sectionTitleStyle}>Social Links</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <Input
            label="Website"
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://"
          />
          <Input
            label="Instagram"
            value={form.instagram}
            onChange={(e) => set("instagram", e.target.value)}
            placeholder="@rpmpub"
          />
          <Input
            label="Facebook"
            value={form.facebook}
            onChange={(e) => set("facebook", e.target.value)}
          />
          <Input label="Twitter / X" value={form.twitter} onChange={(e) => set("twitter", e.target.value)} />
        </div>
      </Card>

      <Card>
        <h2 style={sectionTitleStyle}>Business Hours</h2>
        <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", marginTop: -8 }}>
          Display-only on the public menu footer — not tied to display scheduling.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {DAYS.map(({ key, label }) => {
            const day = form.hours[key] ?? {};
            return (
              <div
                key={key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 1fr auto",
                  gap: "var(--sp-3)",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </span>
                <Input
                  type="time"
                  value={day.open ?? ""}
                  disabled={day.closed}
                  onChange={(e) => setDay(key, { open: e.target.value })}
                />
                <Input
                  type="time"
                  value={day.close ?? ""}
                  disabled={day.closed}
                  onChange={(e) => setDay(key, { close: e.target.value })}
                />
                <Switch
                  label="Closed"
                  checked={Boolean(day.closed)}
                  onChange={(checked) => setDay(key, { closed: checked })}
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 style={sectionTitleStyle}>Timezone</h2>
        <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", marginTop: -8 }}>
          Drives display schedules (§3.2a) — changing it shifts when every weekly schedule rule fires.
        </p>
        <Input
          label="IANA Timezone"
          value={form.timezone}
          onChange={(e) => set("timezone", e.target.value)}
          list="tz-options"
          placeholder="America/Chicago"
        />
        {tzOptions.length > 0 && (
          <datalist id="tz-options">
            {tzOptions.map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
        )}
      </Card>

      <Card>
        <h2 style={sectionTitleStyle}>Currency / Price Format</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <Input
            label="Currency Symbol"
            value={form.currencySymbol}
            onChange={(e) => set("currencySymbol", e.target.value)}
            style={{ maxWidth: 120 }}
          />
          <Switch
            label={`Show trailing .00 on web (e.g. "${form.currencySymbol || "$"}6${
              form.showTrailingZerosWeb ? ".00" : ""
            }")`}
            checked={form.showTrailingZerosWeb}
            onChange={(checked) => set("showTrailingZerosWeb", checked)}
          />
          <Switch
            label={`Show trailing .00 on TV displays (e.g. "${form.currencySymbol || "$"}6${
              form.showTrailingZerosDisplay ? ".00" : ""
            }")`}
            checked={form.showTrailingZerosDisplay}
            onChange={(checked) => set("showTrailingZerosDisplay", checked)}
          />
        </div>
      </Card>

      {message && (
        <p
          style={{
            color: message.kind === "success" ? "var(--accent-new, #6fbf73)" : "var(--accent-primary)",
            fontFamily: "var(--font-body)",
            fontSize: "0.875rem",
            margin: 0,
          }}
        >
          {message.text}
        </p>
      )}

      <div>
        <Button onClick={handleSaveClick} disabled={saving || checkingImpact}>
          {checkingImpact ? "Checking Impact…" : saving ? "Saving…" : "Save Venue Settings"}
        </Button>
      </div>

      {impact && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div style={{ width: "100%", maxWidth: 460 }}>
            <Card accent>
              <h2 style={sectionTitleStyle}>Timezone Change Impact</h2>
              <p style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
                Changing timezone from <strong>{impact.currentTimezone}</strong> to{" "}
                <strong>{impact.newTimezone}</strong> re-anchors every display schedule&rsquo;s wall-clock evaluation.
              </p>
              <p style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
                {impact.affectedScheduleCount} schedule rule{impact.affectedScheduleCount === 1 ? "" : "s"} across{" "}
                {impact.affectedDisplayCount} display{impact.affectedDisplayCount === 1 ? "" : "s"} will be affected.
              </p>
              <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-4)" }}>
                <Button variant="secondary" onClick={() => setImpact(null)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmTimezoneChange} disabled={saving}>
                  {saving ? "Saving…" : "Confirm & Save"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
