// Shared helper for domain `registerRevertHandler` implementations. A row
// captured into `audit_log.before/after` round-trips through jsonb, which
// turns `Date` columns (createdAt/updatedAt) into ISO strings — reverting by
// writing that object straight back with Drizzle's node-postgres driver
// throws (`value.toISOString is not a function`) because the driver expects
// a real `Date` for `timestamp` columns. This revives any of `dateKeys` that
// are still strings back into `Date` instances before a revert handler
// re-inserts/updates a row.
export function reviveDates<T extends Record<string, unknown>>(row: T, dateKeys: (keyof T)[]): T {
  const revived = { ...row };
  for (const key of dateKeys) {
    const value = revived[key];
    if (typeof value === "string") {
      revived[key] = new Date(value) as T[typeof key];
    }
  }
  return revived;
}
