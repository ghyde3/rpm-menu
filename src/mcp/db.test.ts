import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMcpDb } from "./db";
import { PgliteLockError } from "./pglite-lock";

const ORIGINAL_ENV = { ...process.env };
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rpm-mcp-db-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  while (tempDirs.length) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("createMcpDb", () => {
  it("builds a PGlite-backed client and an acquired lock when no DATABASE_URL is set", () => {
    delete process.env.DATABASE_URL;
    process.env.DB_DRIVER = "pglite";
    process.env.PGLITE_DATA_DIR = makeTempDir();

    const handle = createMcpDb();
    expect(handle.db).toBeDefined();
    expect(handle.pgliteLock).not.toBeNull();
    handle.pgliteLock?.release();
  });

  it("refuses to start a second PGlite client against a data dir the first one still holds", () => {
    delete process.env.DATABASE_URL;
    process.env.DB_DRIVER = "pglite";
    process.env.PGLITE_DATA_DIR = makeTempDir();

    const first = createMcpDb();
    expect(() => createMcpDb()).toThrow(PgliteLockError);

    first.pgliteLock?.release();
  });

  it("builds a Postgres-backed client with no PGlite lock when DATABASE_URL is set", () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:55432/rpm_menu_test_unused";
    delete process.env.DB_DRIVER;

    const handle = createMcpDb();
    expect(handle.db).toBeDefined();
    expect(handle.pgliteLock).toBeNull();
  });
});
