"use client";

// Full-screen image lightbox for the public menu (mobile-polish M5): opening
// an item's hero photo or any gallery thumbnail promotes it into a dark,
// centered overlay showing the largest ("display", ~1920w) webp variant, with
// prev/next paging + swipe across the item's full photo set.
//
// Client-only and self-contained — it renders nothing (returns null) unless a
// photo is open, so it adds no markup to the statically-cached /menu SSR
// output until a visitor actually taps a photo (page.tsx stays a pure Server
// Component; MenuBoard/ItemGallery are the only Client boundaries).
//
// Accessibility: role="dialog" + aria-modal, focus moves into the dialog on
// open and returns to the trigger on close, Escape and the × button and a
// backdrop click all close it, and background scroll is locked while open.
import * as React from "react";
import Image from "next/image";

export interface LightboxPhoto {
  /** Largest variant to render in the overlay. */
  displayUrl: string;
}

export interface ImageLightboxProps {
  photos: LightboxPhoto[];
  /** Index of the photo to open, or null when the lightbox is closed. */
  index: number | null;
  onClose: () => void;
  onIndexChange: (next: number) => void;
  /** Used for the dialog label + image alt text. */
  itemName: string;
}

export function ImageLightbox({ photos, index, onClose, onIndexChange, itemName }: ImageLightboxProps) {
  const open = index !== null;
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const touchStartX = React.useRef<number | null>(null);
  const multiple = photos.length > 1;

  const goPrev = React.useCallback(() => {
    if (index === null) return;
    onIndexChange((index - 1 + photos.length) % photos.length);
  }, [index, photos.length, onIndexChange]);

  const goNext = React.useCallback(() => {
    if (index === null) return;
    onIndexChange((index + 1) % photos.length);
  }, [index, photos.length, onIndexChange]);

  // Escape / arrow-key handling + background scroll lock, only while open.
  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Focus moves into the dialog (the close button) on open.
    closeButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (multiple && e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (multiple && e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "Tab") {
        // Minimal focus trap: keep focus on the close button (the only
        // persistent control) so Tab never escapes to the locked background.
        e.preventDefault();
        closeButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      // Return focus to whatever opened the lightbox.
      previouslyFocused?.focus?.();
    };
  }, [open, multiple, goPrev, goNext, onClose]);

  if (index === null) return null;
  const photo = photos[index] ?? photos[0];
  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${itemName} photo${multiple ? ` ${index + 1} of ${photos.length}` : ""}`}
      ref={dialogRef}
      onClick={(e) => {
        // Backdrop click closes; clicks on the image/controls do not bubble here.
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null || !multiple) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        if (Math.abs(dx) > 40) (dx > 0 ? goPrev : goNext)();
        touchStartX.current = null;
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-5)",
        background: "rgba(9,8,7,0.94)",
        backdropFilter: "blur(4px)",
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        style={{
          position: "absolute",
          top: "var(--sp-4)",
          right: "var(--sp-4)",
          width: "var(--tap-target)",
          height: "var(--tap-target)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.75rem",
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

      {/* The image itself — capped to the viewport, centered. */}
      <div
        style={{
          position: "relative",
          width: "min(92vw, 1100px)",
          height: "min(82vh, 900px)",
        }}
      >
        <Image
          key={photo.displayUrl}
          src={photo.displayUrl}
          alt={itemName}
          fill
          sizes="92vw"
          style={{ objectFit: "contain" }}
          priority
        />
      </div>

      {multiple && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous photo"
            style={arrowStyle("left")}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next photo"
            style={arrowStyle("right")}
          >
            ›
          </button>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "var(--sp-5)",
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              letterSpacing: "var(--ls-caps)",
              fontSize: "var(--fs-caption)",
              color: "var(--text-secondary)",
            }}
          >
            {index + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}

function arrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [side]: "var(--sp-3)",
    width: "var(--tap-target)",
    height: "var(--tap-target)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "2rem",
    lineHeight: 1,
    cursor: "pointer",
    color: "var(--text-primary)",
    background: "var(--surface-inset)",
    border: "var(--bw) solid var(--border-strong)",
    borderRadius: "var(--radius-sm)",
  };
}
