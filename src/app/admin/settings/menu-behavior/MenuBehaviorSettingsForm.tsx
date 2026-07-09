"use client";

// Settings > Menu Behavior (§3.8): global default for unavailable-item
// treatment (hide vs 86-badge) on web + displays (per-screen setting still
// overrides — owned by the screens unit), public menu image/public-tag-
// badge visibility toggles, and SEO title/description. Styled with
// design-system tokens/components only.
import * as React from "react";
import { Button, Card, Input, Switch, Textarea } from "@/components/ds";
import { updateMenuBehaviorAction, type ActionResult } from "./actions";
import { UNAVAILABLE_TREATMENTS, type UnavailableTreatment } from "@/lib/service/settings/menu-behavior-constants";
import type { ResolvedMenuBehavior } from "@/lib/service/settings/menu-behavior";

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  fontSize: "0.9375rem",
  color: "var(--text-primary)",
  margin: "0 0 var(--sp-4) 0",
};

const hintStyle: React.CSSProperties = {
  color: "var(--text-faint)",
  fontFamily: "var(--font-body)",
  fontSize: "0.8125rem",
  marginTop: -8,
};

const TREATMENT_LABELS: Record<UnavailableTreatment, { label: string; hint: string }> = {
  hide: { label: "Hide", hint: "Unavailable items disappear from the menu entirely." },
  badge: { label: "86 Badge", hint: 'Unavailable items stay visible, marked "86\'d".' },
};

interface FormState {
  unavailableTreatment: UnavailableTreatment;
  showImages: boolean;
  showPublicTagBadges: boolean;
  seoTitle: string;
  seoDescription: string;
}

function toFormState(settings: ResolvedMenuBehavior): FormState {
  return {
    unavailableTreatment: settings.unavailableTreatment,
    showImages: settings.showImages,
    showPublicTagBadges: settings.showPublicTagBadges,
    seoTitle: settings.seoTitle ?? "",
    seoDescription: settings.seoDescription ?? "",
  };
}

export function MenuBehaviorSettingsForm({ initialSettings }: { initialSettings: ResolvedMenuBehavior }) {
  const [form, setForm] = React.useState<FormState>(() => toFormState(initialSettings));
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: "success" | "error"; text: string } | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleResult(result: ActionResult<ResolvedMenuBehavior>) {
    if (result.ok) {
      setForm(toFormState(result.data));
      setMessage({ kind: "success", text: "Menu behavior saved." });
    } else {
      setMessage({ kind: "error", text: result.error });
    }
  }

  async function handleSave() {
    setMessage(null);
    setSaving(true);
    const result = await updateMenuBehaviorAction({
      unavailableTreatment: form.unavailableTreatment,
      showImages: form.showImages,
      showPublicTagBadges: form.showPublicTagBadges,
      seoTitle: form.seoTitle || null,
      seoDescription: form.seoDescription || null,
    });
    setSaving(false);
    handleResult(result);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", maxWidth: 720 }}>
      <Card>
        <h2 style={sectionTitleStyle}>Unavailable Items</h2>
        <p style={hintStyle}>
          Global default for web and displays — a screen&rsquo;s own setting can still override this.
        </p>
        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          {UNAVAILABLE_TREATMENTS.map((treatment) => (
            <Button
              key={treatment}
              type="button"
              variant={form.unavailableTreatment === treatment ? "primary" : "secondary"}
              onClick={() => set("unavailableTreatment", treatment)}
            >
              {TREATMENT_LABELS[treatment].label}
            </Button>
          ))}
        </div>
        <p style={{ ...hintStyle, marginTop: "var(--sp-3)" }}>
          {TREATMENT_LABELS[form.unavailableTreatment].hint}
        </p>
      </Card>

      <Card>
        <h2 style={sectionTitleStyle}>Public Menu Display</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <Switch
            label="Show Item Images"
            checked={form.showImages}
            onChange={(checked) => set("showImages", checked)}
          />
          <Switch
            label="Show Public Tag Badges"
            checked={form.showPublicTagBadges}
            onChange={(checked) => set("showPublicTagBadges", checked)}
          />
        </div>
      </Card>

      <Card>
        <h2 style={sectionTitleStyle}>SEO</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <Input
            label="SEO Title"
            value={form.seoTitle}
            onChange={(e) => set("seoTitle", e.target.value)}
            hint={`${form.seoTitle.length}/70`}
            maxLength={70}
          />
          <Textarea
            label="SEO Description"
            value={form.seoDescription}
            onChange={(e) => set("seoDescription", e.target.value)}
            rows={3}
            hint={`${form.seoDescription.length}/200`}
            maxLength={200}
          />
        </div>
      </Card>

      {message && (
        <p
          style={{
            color: message.kind === "success" ? "var(--accent-new)" : "var(--accent-primary)",
            fontFamily: "var(--font-body)",
            fontSize: "0.875rem",
            margin: 0,
          }}
        >
          {message.text}
        </p>
      )}

      <div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Menu Behavior"}
        </Button>
      </div>
    </div>
  );
}
