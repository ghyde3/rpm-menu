// Print-ready QR generation (§3.8 Menu Behavior: "renders/downloads a
// print-ready QR (SVG + PNG) pointing at the public menu -- table tents, no
// third-party QR service with tracking redirects"). Thin wrapper over the
// preinstalled `qrcode` package -- generation happens locally, the payload
// is always the venue's own `/menu` URL, never a shortener/redirect.
import QRCode from "qrcode";

/** High error-correction (~30% of the symbol can be damaged/obscured and
 * still scan) -- table tents get spilled on, so this trades a slightly
 * denser code for durability, matching common print-QR practice. */
const ERROR_CORRECTION_LEVEL = "H" as const;

export interface QrRenderOptions {
  /** Output pixel size for PNG (ignored for SVG, which is resolution-independent). */
  sizePx?: number;
  /** Quiet-zone width in QR "modules" -- qrcode's `margin` option. */
  marginModules?: number;
}

const DEFAULT_PNG_SIZE = 1024;
const DEFAULT_MARGIN_MODULES = 2;

/** Print-ready SVG markup -- vector, scales to any table-tent size with no
 * quality loss. */
export async function generateMenuQrSvg(url: string, opts: QrRenderOptions = {}): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
    margin: opts.marginModules ?? DEFAULT_MARGIN_MODULES,
  });
}

/** Print-ready PNG buffer at a fixed pixel size (defaults to 1024px square
 * -- plenty for a table-tent print, well above typical phone-camera scan
 * distance requirements). */
export async function generateMenuQrPng(url: string, opts: QrRenderOptions = {}): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
    margin: opts.marginModules ?? DEFAULT_MARGIN_MODULES,
    width: opts.sizePx ?? DEFAULT_PNG_SIZE,
  });
}

/** Small inline PNG data URL for an on-page live preview (a fixed small
 * size keeps the admin page payload light -- the download links use the
 * full-size PNG/SVG). */
export async function generateMenuQrPreviewDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
    margin: DEFAULT_MARGIN_MODULES,
    width: 320,
  });
}
