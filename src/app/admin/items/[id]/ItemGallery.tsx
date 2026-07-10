"use client";

// Multi-photo gallery editor (M4 addendum). Consumes the item-images
// service purely through gallery-actions.ts's server actions — this
// component never talks to the DB/service layer directly. Uploads reuse
// the existing image-pipeline route (`POST /api/upload`, multipart `file`
// field) exactly like BackgroundImagePicker.tsx does; this component then
// hands the returned `image.id` to `addItemImageAction`, which is the only
// thing that actually writes to `item_images`.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import type { ItemImageGalleryEntry } from "@/lib/service/item-images";
import {
  addItemImageAction,
  removeItemImageAction,
  reorderItemImagesAction,
  setPrimaryItemImageAction,
} from "./gallery-actions";

export interface ItemGalleryProps {
  itemId: string;
  initialGallery: ItemImageGalleryEntry[];
}

const errorTextStyle: React.CSSProperties = {
  color: "var(--accent-primary)",
  fontFamily: "var(--font-body)",
  fontSize: "0.8125rem",
  margin: 0,
};

function thumbUrl(entry: ItemImageGalleryEntry): string | undefined {
  return entry.variants.card ?? entry.variants.thumb ?? entry.variants.display;
}

export function ItemGallery({ itemId, initialGallery }: ItemGalleryProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [gallery, setGallery] = React.useState(initialGallery);
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [mutatingId, setMutatingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Re-sync when the server passes a fresh gallery after a refresh — set
  // during render (not an effect), matching PriceVariantsEditor's pattern.
  const [prevInitialGallery, setPrevInitialGallery] = React.useState(initialGallery);
  if (initialGallery !== prevInitialGallery) {
    setPrevInitialGallery(initialGallery);
    setGallery(initialGallery);
  }

  const busy = uploading || mutatingId !== null;

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    let uploadedImageId: string | null = null;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      const body = (await res.json()) as { image: { id: string } };
      uploadedImageId = body.image.id;

      const result = await addItemImageAction(itemId, uploadedImageId);
      if (!result.ok) {
        // Best-effort cleanup — don't leave an orphaned images row behind
        // just because this item's gallery rejected it.
        fetch(`/api/upload?id=${uploadedImageId}`, { method: "DELETE" }).catch(() => {});
        throw new Error(result.error);
      }
      setGallery(result.data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void uploadFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void uploadFile(file);
  }

  async function handleRemove(entry: ItemImageGalleryEntry) {
    if (!window.confirm("Remove this photo from the gallery?")) return;
    setMutatingId(entry.id);
    setError(null);
    const result = await removeItemImageAction(itemId, entry.id);
    setMutatingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setGallery(result.data);
    router.refresh();
  }

  async function handleSetPrimary(entry: ItemImageGalleryEntry) {
    setMutatingId(entry.id);
    setError(null);
    const result = await setPrimaryItemImageAction(itemId, entry.id);
    setMutatingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setGallery(result.data);
    router.refresh();
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= gallery.length) return;
    const reordered = gallery.slice();
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    setMutatingId(gallery[index].id);
    setError(null);
    const result = await reorderItemImagesAction(
      itemId,
      reordered.map((e) => e.id),
    );
    setMutatingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setGallery(result.data);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      {error && <p style={errorTextStyle}>{error}</p>}

      {gallery.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--sp-2)",
            padding: "var(--sp-6) var(--sp-4)",
            textAlign: "center",
            border: "var(--bw) dashed " + (dragOver ? "var(--accent-primary)" : "var(--border-strong)"),
            borderRadius: "var(--radius-md)",
            background: "var(--surface-inset)",
          }}
        >
          <p style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "0.9375rem", margin: 0 }}>
            No photos yet — upload one.
          </p>
          <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", margin: 0 }}>
            The first photo you add becomes the hero image shown on the menu.
          </p>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: "var(--sp-3)",
            padding: dragOver ? "var(--sp-2)" : 0,
            border: dragOver ? "var(--bw) dashed var(--accent-primary)" : "var(--bw) solid transparent",
            borderRadius: "var(--radius-md)",
            transition: "border-color var(--dur) var(--ease)",
          }}
        >
          {gallery.map((entry, index) => {
            const url = thumbUrl(entry);
            const isMutating = mutatingId === entry.id;
            return (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--sp-2)",
                  opacity: isMutating ? 0.5 : 1,
                  transition: "opacity var(--dur-fast) var(--ease)",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "1 / 1",
                    overflow: "hidden",
                    background: "var(--surface-inset)",
                    border: "var(--bw) solid " + (entry.isPrimary ? "var(--accent-primary)" : "var(--border-hairline)"),
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- fixed thumbnail grid; next/image's layout overhead isn't worth it here.
                    <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : null}
                  {entry.isPrimary && (
                    <span
                      style={{
                        position: "absolute",
                        top: "var(--sp-1)",
                        left: "var(--sp-1)",
                        padding: "2px var(--sp-2)",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--accent-primary)",
                        color: "#fff",
                        fontFamily: "var(--font-heading)",
                        fontSize: "0.625rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "var(--ls-caps)",
                      }}
                    >
                      Hero
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-1)" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy || index === 0}
                    onClick={() => handleMove(index, -1)}
                    style={{ padding: "0 var(--sp-2)", height: 30, fontSize: "0.6875rem" }}
                    aria-label="Move earlier"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy || index === gallery.length - 1}
                    onClick={() => handleMove(index, 1)}
                    style={{ padding: "0 var(--sp-2)", height: 30, fontSize: "0.6875rem" }}
                    aria-label="Move later"
                  >
                    ↓
                  </Button>
                  {!entry.isPrimary && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => handleSetPrimary(entry)}
                      style={{ padding: "0 var(--sp-2)", height: 30, fontSize: "0.6875rem" }}
                    >
                      Set Hero
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() => handleRemove(entry)}
                    style={{ padding: "0 var(--sp-2)", height: 30, fontSize: "0.6875rem" }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
        <Button variant="secondary" size="sm" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
          {uploading ? "Uploading…" : "Upload Photo"}
        </Button>
        <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.75rem" }}>
          or drag a photo onto the grid above
        </span>
      </div>
    </div>
  );
}
