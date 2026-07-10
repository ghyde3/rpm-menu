// Settings > QR Code Generator (§3.8/§9 M3): print-ready SVG + PNG QR
// pointing at the public menu -- table tents, no third-party QR service with
// tracking redirects. Owned by the
// settings-api-keys-data-recovery-sessions-qr unit. Promoted from the former
// nested route (settings/menu-behavior/qr) to its own top-level Settings
// item; the old path redirects here.
import type { CSSProperties } from "react";
import { getCurrentSession } from "@/lib/auth/session";
import { getPublicMenuUrl, generateMenuQrPreviewDataUrl } from "@/lib/qr";
import { Button, Card } from "@/components/ds";

function pageTitleStyle(): CSSProperties {
  return {
    fontFamily: "var(--font-display)",
    textTransform: "uppercase",
    color: "var(--accent-primary)",
    fontSize: "var(--fs-h3)",
    margin: 0,
  };
}

const sectionTitleStyle: CSSProperties = {
  fontFamily: "var(--font-heading)",
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  fontSize: "0.9375rem",
  color: "var(--text-primary)",
  margin: "0 0 var(--sp-4) 0",
};

function OwnerOnlyNotice() {
  return (
    <div>
      <h1 style={pageTitleStyle()}>Settings · QR Code</h1>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <Card>
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            The QR code generator is owner-only (§3.8). Ask an owner to make changes here.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default async function MenuQrPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "owner") {
    return <OwnerOnlyNotice />;
  }

  const url = getPublicMenuUrl();
  const previewDataUrl = await generateMenuQrPreviewDataUrl(url);

  return (
    <div>
      <h1 style={pageTitleStyle()}>Settings · QR Code</h1>

      <div style={{ marginTop: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
        <Card>
          <h2 style={sectionTitleStyle}>Print-Ready QR Code</h2>
          <p style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
            Points straight at your public menu -- no third-party QR service, no tracking redirect. Generated
            locally with high error correction so it still scans on a scuffed table tent.
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--text-faint)",
              fontSize: "0.8125rem",
              wordBreak: "break-all",
            }}
          >
            {url}
          </p>

          <div style={{ display: "flex", gap: "var(--sp-5)", alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewDataUrl}
              alt="QR code linking to the public menu"
              width={220}
              height={220}
              style={{ background: "#fff", padding: 12, borderRadius: "var(--radius-sm)" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              <a href="/api/menu-qr?format=svg&download=1">
                <Button variant="secondary">Download SVG</Button>
              </a>
              <a href="/api/menu-qr?format=png&download=1&size=2048">
                <Button variant="secondary">Download PNG (2048px)</Button>
              </a>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
