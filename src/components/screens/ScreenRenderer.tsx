"use client";

// The shared runtime component — "same route, same code" per PRD §3.2's
// preview requirement. The admin live-preview page renders this directly;
// the displays unit's future `/display/render` TV route is expected to
// import this same component (see this directory's ownership in the plan)
// rather than re-implementing template/overflow logic.
import { SCREEN_TEMPLATES } from "./templates";
import { useOverflowFit } from "./useOverflowFit";
import type { ResolvedScreen } from "@/lib/screens/resolve";
import { DEFAULT_PAGINATION_INTERVAL_SECONDS } from "@/lib/screens/overflow";

export interface ScreenRendererProps {
  resolved: ResolvedScreen;
}

export function ScreenRenderer({ resolved }: ScreenRendererProps) {
  const { screen, items, title, backgroundImageUrl } = resolved;
  const options = screen.displayOptions ?? {};
  const paginationIntervalSeconds = options.paginationIntervalSeconds ?? DEFAULT_PAGINATION_INTERVAL_SECONDS;
  const Template = SCREEN_TEMPLATES[screen.template] ?? SCREEN_TEMPLATES.list;
  const baseFontScale = options.fontScale ?? 1;

  const { containerRef, measureRef, scale, pageItems, pageIndex, pageCount } = useOverflowFit(
    items,
    paginationIntervalSeconds,
  );

  const appliedScale = scale * baseFontScale;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--surface-base, #121110)",
        backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        color: "var(--text-primary)",
        fontFamily: "var(--font-body)",
      }}
    >
      {backgroundImageUrl && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} aria-hidden />
      )}

      {/* Hidden measurement pass: full item set, never scaled, used only to
          decide fit/pagination (see useOverflowFit.ts). */}
      <div
        ref={measureRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          visibility: "hidden",
          pointerEvents: "none",
          padding: "var(--sp-6)",
        }}
        aria-hidden
      >
        <Template title={title} accentColor={options.accentColor} columns={options.columns} items={items} />
      </div>

      {/* Visible layer: current page, scaled to fit. */}
      <div
        style={{
          position: "relative",
          transform: `scale(${appliedScale})`,
          transformOrigin: "top left",
          width: `${100 / appliedScale}%`,
          padding: "var(--sp-6)",
        }}
      >
        <Template title={title} accentColor={options.accentColor} columns={options.columns} items={pageItems} />
      </div>

      {pageCount > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: "var(--sp-3)",
            right: "var(--sp-3)",
            display: "flex",
            gap: 6,
          }}
          aria-hidden
        >
          {Array.from({ length: pageCount }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: i === pageIndex ? "var(--accent-primary)" : "var(--border-strong)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
