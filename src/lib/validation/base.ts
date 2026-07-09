// Shared Zod primitives. Every domain validation file (src/lib/validation/
// items.ts, screens.ts, etc — owned by their respective feature units)
// imports from here so there is exactly one definition of "what's a valid
// id / price / actor / surface" across the whole service layer (§3.6).
import { z } from "zod";
import { ENTITY_TYPES, actorTypeEnum, surfaceEnum } from "@/db/schema";
import { API_KEY_SCOPES } from "@/db/schema/apiKeys";

export const uuidSchema = z.uuid();

/** Integer cents — the only price representation that ever reaches the DB
 * (§5.1 notes: "prices always integer cents"). */
export const centsSchema = z.number().int().min(0).max(10_000_00);

/** Nullable integer cents — for `items.price_cents` (addendum §2: nullable
 * for ask_server/tbd pricing). */
export const nullableCentsSchema = centsSchema.nullable();

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export const entityTypeSchema = z.enum(ENTITY_TYPES);
export const actorTypeSchema = z.enum(actorTypeEnum);
export const surfaceSchema = z.enum(surfaceEnum);
export const apiKeyScopeSchema = z.enum(API_KEY_SCOPES);

export type Pagination = z.infer<typeof paginationSchema>;
