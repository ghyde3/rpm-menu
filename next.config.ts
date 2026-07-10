import type { NextConfig } from "next";
import { buildContentSecurityPolicy } from "./src/lib/security/csp";

// PRD §3.6: "CSP headers on display/public routes." /menu and /display/**
// are the two unauthenticated surfaces the PRD names explicitly. Applied
// via next.config.ts's headers() (rather than middleware) so it's plain
// static config, not something a future route change can accidentally skip.
//
// The policy itself (including the dev-only `'unsafe-eval'` allowance that
// silences Turbopack's eval() console error) lives in src/lib/security/csp.ts
// so it's unit-testable — see that file's header for the full rationale.
const CSP = buildContentSecurityPolicy(process.env.NODE_ENV);

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
  // Item photos in production are served from the Vercel Blob store
  // (`<storeId>.public.blob.vercel-storage.com`). next/image proxies remote
  // images through `/_next/image`, which returns 400 for any host not
  // allowlisted here — so without this every menu photo fails to load in prod.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
  async headers() {
    return [
      { source: "/menu", headers: securityHeaders },
      { source: "/display", headers: securityHeaders },
      { source: "/display/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
