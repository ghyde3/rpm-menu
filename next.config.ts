import type { NextConfig } from "next";

// PRD §3.6: "CSP headers on display/public routes." /menu and /display/**
// are the two unauthenticated surfaces the PRD names explicitly. Applied
// via next.config.ts's headers() (rather than middleware) so it's plain
// static config, not something a future route change can accidentally skip.
//
// `script-src 'self' 'unsafe-inline'` is required because Next.js injects
// inline bootstrap/hydration `<script>` tags on every page; a stricter
// nonce-based policy would need per-request nonce plumbing through the App
// Router's root layout, which is a larger change than this hardening pass.
// It still meaningfully blocks the class of attack the JSON-LD injection
// finding raised: `object-src 'none'`, `frame-ancestors 'none'`, and a
// same-origin-only `default-src`/`connect-src` stop an injected script from
// loading a remote payload, embedding the page, or exfiltrating data to an
// attacker-controlled origin, even though it can still run same-origin JS.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  // @electric-sql/pglite loads its WASM/data files via
  // `new URL('./file', import.meta.url)` at runtime. If Turbopack bundles
  // the package into the server runtime graph, that URL resolution gets
  // mangled and PGlite throws `TypeError: The "path" argument must be of
  // type string ... Received an instance of URL` on every query. Marking it
  // external keeps Next's server runtime `require()`-ing it from
  // node_modules unbundled, like Node itself would.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      { source: "/menu", headers: securityHeaders },
      { source: "/display", headers: securityHeaders },
      { source: "/display/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
