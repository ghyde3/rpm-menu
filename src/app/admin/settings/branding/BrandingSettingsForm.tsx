"use client";

// Settings > Branding (§3.8): logo upload (via the §3.1a image pipeline,
// POST/DELETE /api/upload), brand color palette (primary/accent), and a
// curated font choice. Styled with design-system tokens/components only.
import * as React from "react";
import { Button, Card } from "@/components/ds";
import { updateBrandingAction, type ActionResult } from "./actions";
import {
  BRANDING_COLOR_SWATCHES,
  BRANDING_FONT_OPTIONS,
  BRANDING_FONT_STACKS,
  type BrandingFont,
} from "@/lib/service/settings/branding-constants";
import type { BrandingSettings } from "@/lib/service/settings/branding";
import type { Image } from "@/lib/service/images";

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

interface UploadResponse {
  image: Image;
}

async function uploadLogoFile(file: File): Promise<Image> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const body = (await res.json().catch(() => ({}))) as UploadResponse & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Upload failed (${res.status})`);
  }
  return body.image;
}

async function deleteImageBestEffort(imageId: string): Promise<void> {
  try {
    await fetch(`/api/upload?id=${encodeURIComponent(imageId)}`, { method: "DELETE" });
  } catch {
    // Best-effort cleanup only — a failed delete just leaves an orphaned
    // file, no user-visible impact (mirrors src/lib/service/images.ts's own
    // best-effort cleanup rationale).
  }
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  // Fully controlled by the parent's `value` — no local buffer state, so
  // every keystroke updates the parent directly. Save-time Zod validation
  // (hexColorSchema in settings/branding.ts) is the actual gate; this field
  // just reflects whatever's typed and highlights a matching swatch.
  function commit(next: string) {
    onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "0.75rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "var(--ls-caps)",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}>
        {BRANDING_COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch.value}
            type="button"
            title={swatch.label}
            onClick={() => commit(swatch.value)}
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-sm)",
              background: swatch.value,
              cursor: "pointer",
              border:
                value.toLowerCase() === swatch.value
                  ? "3px solid var(--text-primary)"
                  : "var(--bw) solid var(--border-strong)",
              padding: 0,
            }}
          />
        ))}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            background: "var(--surface-inset)",
            border: "var(--bw) solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            padding: "0 var(--sp-3)",
            height: 44,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 20,
              height: 20,
              borderRadius: "var(--radius-sm)",
              background: /^#[0-9a-fA-F]{6}$/.test(value) ? value : "transparent",
              border: "var(--bw) solid var(--border-strong)",
              flexShrink: 0,
            }}
          />
          <input
            value={value}
            onChange={(e) => commit(e.target.value)}
            placeholder="#d63a2c"
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--fs-body-sm)",
              width: 100,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function BrandingSettingsForm({
  initialSettings,
  initialLogoImage,
}: {
  initialSettings: BrandingSettings;
  initialLogoImage: Image | null;
}) {
  const [primaryColor, setPrimaryColor] = React.useState(initialSettings.branding.primaryColor ?? "#d63a2c");
  const [accentColor, setAccentColor] = React.useState(initialSettings.branding.accentColor ?? "#e8632a");
  const [font, setFont] = React.useState<BrandingFont>(
    (initialSettings.branding.font as BrandingFont) ?? "oswald",
  );
  const [logoImage, setLogoImage] = React.useState<Image | null>(initialLogoImage);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: "success" | "error"; text: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleResult(result: ActionResult<BrandingSettings>, successText: string) {
    if (result.ok) {
      setMessage({ kind: "success", text: successText });
    } else {
      setMessage({ kind: "error", text: result.error });
    }
    return result;
  }

  async function handleSave() {
    setMessage(null);
    setSaving(true);
    const result = await updateBrandingAction({ primaryColor, accentColor, font });
    setSaving(false);
    handleResult(result, "Branding saved.");
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setMessage(null);
    setUploading(true);
    try {
      const uploaded = await uploadLogoFile(file);
      const result = await updateBrandingAction({ logoImageId: uploaded.id });
      if (result.ok) {
        const previousImage = logoImage;
        setLogoImage(uploaded);
        setMessage({ kind: "success", text: "Logo uploaded." });
        if (previousImage && previousImage.id !== uploaded.id) {
          await deleteImageBestEffort(previousImage.id);
        }
      } else {
        setMessage({ kind: "error", text: result.error });
        await deleteImageBestEffort(uploaded.id);
      }
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveLogo() {
    if (!logoImage) return;
    setMessage(null);
    setSaving(true);
    const result = await updateBrandingAction({ logoImageId: null });
    setSaving(false);
    if (result.ok) {
      const removed = logoImage;
      setLogoImage(null);
      setMessage({ kind: "success", text: "Logo removed." });
      await deleteImageBestEffort(removed.id);
    } else {
      setMessage({ kind: "error", text: result.error });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", maxWidth: 720 }}>
      <Card>
        <h2 style={sectionTitleStyle}>Logo</h2>
        <p style={hintStyle}>Rendered on the public menu and screen templates by default.</p>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "var(--radius-md)",
              background: "var(--surface-inset)",
              border: "var(--bw) solid var(--border-strong)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {logoImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoImage.variants.card ?? logoImage.variants.thumb}
                alt="Venue logo"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <span style={{ color: "var(--text-faint)", fontSize: "0.75rem", fontFamily: "var(--font-body)" }}>
                No logo
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChosen}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading…" : logoImage ? "Replace Logo" : "Upload Logo"}
              </Button>
              {logoImage && (
                <Button variant="danger" size="sm" onClick={handleRemoveLogo} disabled={saving || uploading}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 style={sectionTitleStyle}>Brand Colors</h2>
        <p style={hintStyle}>
          Default primary/accent for the public menu and screen templates — individual screens can still
          override accent color (§3.2).
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <ColorField label="Primary Color" value={primaryColor} onChange={setPrimaryColor} />
          <ColorField label="Accent Color" value={accentColor} onChange={setAccentColor} />
        </div>
      </Card>

      <Card>
        <h2 style={sectionTitleStyle}>Font</h2>
        <p style={hintStyle}>A curated set — not a font picker free-for-all.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {BRANDING_FONT_OPTIONS.map((option) => (
            <label
              key={option.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-3)",
                padding: "var(--sp-3)",
                borderRadius: "var(--radius-sm)",
                border:
                  font === option.value
                    ? "var(--bw) solid var(--accent-primary)"
                    : "var(--bw) solid var(--border-hairline)",
                background: font === option.value ? "var(--surface-hover)" : "transparent",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="branding-font"
                checked={font === option.value}
                onChange={() => setFont(option.value)}
              />
              <span
                style={{
                  fontFamily: BRANDING_FONT_STACKS[option.value],
                  fontSize: "1.125rem",
                  color: "var(--text-primary)",
                }}
              >
                {option.label}
              </span>
            </label>
          ))}
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
        <Button onClick={handleSave} disabled={saving || uploading}>
          {saving ? "Saving…" : "Save Branding"}
        </Button>
      </div>
    </div>
  );
}
