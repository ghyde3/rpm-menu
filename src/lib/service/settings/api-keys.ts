// Settings > API Keys tab (§3.7 "management UI lives here" + §3.8): create
// (name + scope checkboxes, secret shown once, hashed at rest), list
// (scopes, created, last-used), revoke. Owner-only per §3.8's section
// header -- API keys are a security-sensitive surface, same posture as
// every other Settings tab in this codebase.
//
// Hashing/generation primitive (`src/lib/api-keys/hash.ts`) is foundation-
// owned and already built; this file is the CRUD + audit/revert layer the
// admin UI calls. Per-request auth (verifying a presented key against
// `key_hash`, scope checks, `last_used_at` bump, rate limiting) is the
// REST API/MCP unit's job against the same `api_keys` table -- out of
// scope here (§3.7's "management UI" vs. the request-time auth middleware
// are different owns_paths).
//
// Zod validation lives inline in this file rather than a shared
// src/lib/validation/settings.ts -- this unit's owns_paths don't include
// the validation directory, and no other unit needs these schemas (mirrors
// users.ts's identical note).
import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiKeys, API_KEY_SCOPES, type ApiKeyScope } from "@/db/schema";
import { generateApiKey } from "@/lib/api-keys/hash";
import { apiKeyScopeSchema, uuidSchema } from "@/lib/validation/base";
import {
  requireOwnerCaller,
  withAudit,
  registerRevertHandler,
  reviveDates,
  type DbClient,
  type ServiceCaller,
} from "../base";
import { NotFoundError, ConflictError } from "../base/errors";

export type ApiKeyRow = typeof apiKeys.$inferSelect;
/** Never expose `key_hash` back to any client -- it's a SHA-256 digest (not
 * a secret you could scam anyone with) but there is no reason to ever
 * round-trip it and every other "safe row" type in this codebase (SafeUser)
 * follows the same "strip what you never need to show" convention. */
export type SafeApiKey = Omit<ApiKeyRow, "keyHash">;

function toSafeApiKey(row: ApiKeyRow): SafeApiKey {
  const safe: Partial<ApiKeyRow> = { ...row };
  delete safe.keyHash;
  return safe as SafeApiKey;
}

// --- Validation -------------------------------------------------------------

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(200),
  scopes: z.array(apiKeyScopeSchema).min(1, "Select at least one scope"),
});
export type CreateApiKeyInput = z.input<typeof createApiKeySchema>;

const revokeApiKeySchema = z.object({ id: uuidSchema });

// --- Helpers ------------------------------------------------------------

async function getApiKeyOrThrow(db: DbClient, id: string): Promise<ApiKeyRow> {
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
  if (!row) throw new NotFoundError("api_key", id);
  return row;
}

// --- Reads ----------------------------------------------------------------

export async function listApiKeys(db: DbClient, caller: ServiceCaller): Promise<SafeApiKey[]> {
  requireOwnerCaller(caller);
  const rows = await db.select().from(apiKeys);
  return rows
    .map(toSafeApiKey)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// --- Writes ---------------------------------------------------------------

export interface CreateApiKeyResult {
  apiKey: SafeApiKey;
  /** Shown once -- see module doc. Never logged, never persisted in
   * plaintext, never included in the audit row (only the hash and scopes
   * are, via `after`). */
  plaintextKey: string;
}

/** Every scope actually exists in the fixed §3.7 registry -- redundant with
 * the Zod enum, but this also guards against a scopes array that Zod would
 * accept structurally (e.g. duplicate entries) yet shouldn't be persisted
 * as-is. */
function normalizeScopes(scopes: ApiKeyScope[]): ApiKeyScope[] {
  const deduped = Array.from(new Set(scopes));
  return API_KEY_SCOPES.filter((s) => deduped.includes(s));
}

export async function createApiKey(
  db: DbClient,
  caller: ServiceCaller,
  rawInput: CreateApiKeyInput,
): Promise<CreateApiKeyResult> {
  requireOwnerCaller(caller);
  const input = createApiKeySchema.parse(rawInput);
  const scopes = normalizeScopes(input.scopes as ApiKeyScope[]);

  const { plaintext, hash } = generateApiKey();

  const created = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "create_api_key",
      entityType: "api_key",
      entityId: null,
      before: null,
    },
    async () => {
      const [row] = await db
        .insert(apiKeys)
        .values({ name: input.name, keyHash: hash, scopes })
        .returning();
      // `after` intentionally omits the plaintext key and the hash isn't
      // sensitive, but there's no reason to snapshot it into the audit log
      // either -- keep the audit row to the fields that matter for a
      // revert (name/scopes) plus the id.
      return { result: row, after: { id: row.id, name: row.name, scopes: row.scopes } };
    },
  );

  return { apiKey: toSafeApiKey(created), plaintextKey: plaintext };
}

/** Revokes a key (sets `revoked_at`). Idempotent-refusing: revoking an
 * already-revoked key is a no-op error rather than silently succeeding, so
 * the UI can distinguish "just revoked" from "already was". */
export async function revokeApiKey(db: DbClient, caller: ServiceCaller, rawId: string): Promise<SafeApiKey> {
  requireOwnerCaller(caller);
  const { id } = revokeApiKeySchema.parse({ id: rawId });
  const before = await getApiKeyOrThrow(db, id);
  if (before.revokedAt) {
    throw new ConflictError("This API key is already revoked.");
  }

  const updated = await withAudit(
    db,
    {
      actor: caller.actor,
      surface: caller.surface,
      action: "revoke_api_key",
      entityType: "api_key",
      entityId: id,
      before,
    },
    async () => {
      const [after] = await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(eq(apiKeys.id, id))
        .returning();
      return { result: after, after };
    },
  );

  return toSafeApiKey(updated);
}

// --- Revert registration ----------------------------------------------
//
// `before === null` => create_api_key, so revert deletes the row. Otherwise
// `before` is a full `ApiKeyRow` snapshot (revoke_api_key) -- restore it
// verbatim, reviving `createdAt`/`lastUsedAt`/`revokedAt` back into `Date`
// instances (see reviveDates's doc: jsonb round-tripping stringifies them).
//
// NOTE for integration: `src/lib/service/revert.ts` (owned by the audit/
// revert unit, not this one) must import this module once on the revert
// code path -- the same "the owning service module must be imported
// somewhere" requirement every other registered handler already satisfies
// via that file's side-effect import list. Flagged for the orchestrator/
// integration pass since this file's owns_path doesn't include revert.ts.
registerRevertHandler("api_key", async (db, ctx) => {
  if (!ctx.entityId) throw new ConflictError("api_key revert requires an entity_id");
  if (ctx.before === null || ctx.before === undefined) {
    await db.delete(apiKeys).where(eq(apiKeys.id, ctx.entityId));
    return;
  }
  const beforeRow = reviveDates(ctx.before as ApiKeyRow, ["createdAt", "lastUsedAt", "revokedAt"]);
  const existing = await db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.id, ctx.entityId));
  if (existing.length === 0) {
    await db.insert(apiKeys).values(beforeRow);
  } else {
    await db.update(apiKeys).set(beforeRow).where(eq(apiKeys.id, ctx.entityId));
  }
});
