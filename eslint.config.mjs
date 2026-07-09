import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reference-only source material — never edited, never linted (see
    // repo root rules in CLAUDE.md).
    "RPM Pub Design System/**",
    // Generated SQL, not app source.
    "drizzle/**",
  ]),
]);

export default eslintConfig;
