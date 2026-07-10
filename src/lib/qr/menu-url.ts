// The public menu URL every QR code (and this settings tab) points at.
// Mirrors the exact `NEXT_PUBLIC_APP_URL` convention src/app/menu/page.tsx
// already uses for its own absolute-URL needs (canonical/OG tags), so both
// places agree on what "the public menu URL" means without a second env var.
const DEFAULT_SITE_URL = "http://localhost:3000";

export function getPublicMenuUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_SITE_URL).replace(/\/+$/, "");
  return `${base}/menu`;
}
