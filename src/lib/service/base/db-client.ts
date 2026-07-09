import type { Database } from "@/db";

/**
 * A Drizzle client OR an in-flight transaction handle (the callback param of
 * `db.transaction(async (tx) => ...)`). Every mutating service function
 * should accept this type for its db parameter so callers can compose
 * multiple service calls into one atomic transaction when needed, while
 * still working with the bare `db` singleton for single-statement mutations.
 */
export type DbClient = Database;
