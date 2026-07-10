"use client";

// Screen background/hero image (§3.1a: "categories and screens may also
// have a background/hero image"). Uploads go straight to the image-pipeline
// unit's documented contract (`POST /api/upload`, multipart `file` field,
// admin-session-authenticated — see wave-1 notes) from the client; this
// component then stores the returned `image.id` as `backgroundImageKey` via
// the screens service's own audited `updateScreen` call (image-pipeline
// intentionally never touches consuming tables itself).
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ds";
import type { Image as ImageRow } from "@/lib/service/images";
import { updateScreenAction } from "../actions";

export interface BackgroundImagePickerProps {
  screenId: string;
  currentImageId: string | null;
  images: ImageRow[];
}

export function BackgroundImagePicker({ screenId, currentImageId, images }: BackgroundImagePickerProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function setBackground(imageId: string | null) {
    setError(null);
    const result = await updateScreenAction(screenId, { backgroundImageKey: imageId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      const body = (await res.json()) as { image: { id: string } };
      await setBackground(body.image.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <h2
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "0.875rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "var(--ls-caps)",
          color: "var(--text-muted)",
          marginBottom: "var(--sp-3)",
        }}
      >
        Background image
      </h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)", alignItems: "flex-start" }}>
        <button
          type="button"
          onClick={() => setBackground(null)}
          style={{
            width: 96,
            height: 54,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.6875rem",
            color: "var(--text-faint)",
            fontFamily: "var(--font-body)",
            background: "var(--surface-inset)",
            border:
              "var(--bw) solid " + (currentImageId === null ? "var(--accent-primary)" : "var(--border-strong)"),
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
          }}
        >
          None
        </button>
        {images.map((img) => {
          const thumb = img.variants.thumb ?? img.variants.card ?? img.variants.display;
          const active = img.id === currentImageId;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => setBackground(img.id)}
              style={{
                width: 96,
                height: 54,
                padding: 0,
                overflow: "hidden",
                background: "var(--surface-inset)",
                border: "var(--bw) solid " + (active ? "var(--accent-primary)" : "var(--border-strong)"),
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
              }}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element -- fixed small thumbnail grid; next/image's layout overhead isn't worth it here.
                <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: "var(--sp-3)", display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
        <Button variant="secondary" size="sm" type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading…" : "Upload New"}
        </Button>
        {error && (
          <span style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
            {error}
          </span>
        )}
      </div>
    </Card>
  );
}
