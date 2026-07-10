// Single Drizzle schema barrel. Every table in PRD §5.1 plus every table/
// column from the data-model addendum lives under src/db/schema/** and is
// re-exported here. This is the ONLY schema source of truth — feature units
// never edit these files directly (see docs/architecture.md).
export * from "./auth";
export * from "./images";
export * from "./catalog";
export * from "./itemImages";
export * from "./modifiers";
export * from "./screens";
export * from "./displays";
export * from "./settings";
export * from "./apiKeys";
export * from "./pendingChanges";
export * from "./auditLog";
export * from "./rateLimit";
