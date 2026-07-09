// Barrel for the foundation-owned domain service modules built alongside
// the schema (items/categories/tags/modifiers). Later feature units add
// their own domain files (screens.ts, displays.ts, ...) and are welcome to
// extend this barrel — it is not foundation-exclusive the way
// src/db/schema/** is.
export * from "./items";
export * from "./categories";
export * from "./tags";
export * from "./modifiers";
export * from "./base";
