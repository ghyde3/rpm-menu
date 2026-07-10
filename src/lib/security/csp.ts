// Content-Security-Policy for the two unauthenticated surfaces the PRD §3.6
// names — /menu and /display/**. Extracted from next.config.ts as a pure,
// env-parameterized function so the "dev allows eval, prod never does" rule
// is directly unit-testable (next.config.ts's `headers()` runs inside Next's
// build, not vitest).
//
// `script-src 'self' 'unsafe-inline'` is required because Next.js injects
// inline bootstrap/hydration <script> tags on every page; a stricter
// nonce-based policy would need per-request nonce plumbing through the App
// Router root layout. `object-src 'none'`, `frame-ancestors 'none'`, and a
// same-origin-only `default-src`/`connect-src` still block an injected script
// from loading a remote payload, embedding the page, or exfiltrating data.
//
// In DEVELOPMENT only, React/Next under Turbopack uses eval() for fast-refresh
// and debugging, so `script-src` must include `'unsafe-eval'` or the browser
// console throws "eval() is not supported in this environment ... make sure
// that `unsafe-eval` is included". React never uses eval() in production, so
// the production policy stays strict — no `'unsafe-eval'`.

/** `script-src` directive for the given NODE_ENV — adds `'unsafe-eval'` for
 * every non-production environment, never for production. */
export function buildScriptSrc(nodeEnv: string | undefined): string {
  const base = "script-src 'self' 'unsafe-inline'";
  return nodeEnv === "production" ? base : `${base} 'unsafe-eval'`;
}

/** The full CSP header value for the given NODE_ENV. */
export function buildContentSecurityPolicy(nodeEnv: string | undefined): string {
  return [
    "default-src 'self'",
    buildScriptSrc(nodeEnv),
    "style-src 'self' 'unsafe-inline'",
    // `blob:` is the browser blob: URI scheme; the Vercel Blob CDN host is a
    // separate https origin that must be allowlisted so raw <img> tags (e.g.
    // the /menu lightbox's full-size photo) aren't CSP-blocked in production.
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
