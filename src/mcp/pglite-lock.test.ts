import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquirePgliteLock, PgliteLockError } from "./pglite-lock";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rpm-mcp-lock-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("acquirePgliteLock", () => {
  it("acquires a fresh lock on an empty directory and writes a lock file", () => {
    const dir = makeTempDir();
    const lock = acquirePgliteLock(dir);
    expect(existsSync(join(dir, ".mcp-server.lock"))).toBe(true);
    const contents = JSON.parse(readFileSync(join(dir, ".mcp-server.lock"), "utf8"));
    expect(contents.pid).toBe(process.pid);
    lock.release();
  });

  it("release() removes the lock file so a subsequent acquire succeeds", () => {
    const dir = makeTempDir();
    const lock = acquirePgliteLock(dir);
    lock.release();
    expect(existsSync(join(dir, ".mcp-server.lock"))).toBe(false);

    // Reacquiring after release must not throw.
    const second = acquirePgliteLock(dir);
    second.release();
  });

  it("release() is idempotent (safe to call twice)", () => {
    const dir = makeTempDir();
    const lock = acquirePgliteLock(dir);
    lock.release();
    expect(() => lock.release()).not.toThrow();
  });

  it("refuses to acquire when a live process already holds the lock", () => {
    const dir = makeTempDir();
    // Our own process is definitely "alive" -- simulate another live holder
    // by writing a lock file naming our own pid before attempting to
    // acquire, without going through the real acquire path.
    writeFileSync(
      join(dir, ".mcp-server.lock"),
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );

    expect(() => acquirePgliteLock(dir)).toThrow(PgliteLockError);
    expect(() => acquirePgliteLock(dir)).toThrow(/already in use/);
  });

  it("reclaims a stale lock left by a dead pid", () => {
    const dir = makeTempDir();
    // PID 2^30 is astronomically unlikely to correspond to a live process on
    // any real machine (Linux/macOS pid_max tops out far below this).
    const deadPid = 999_999_999;
    writeFileSync(
      join(dir, ".mcp-server.lock"),
      JSON.stringify({ pid: deadPid, startedAt: new Date().toISOString() }),
    );

    const lock = acquirePgliteLock(dir);
    const contents = JSON.parse(readFileSync(join(dir, ".mcp-server.lock"), "utf8"));
    expect(contents.pid).toBe(process.pid);
    lock.release();
  });

  it("creates the data directory if it doesn't exist yet", () => {
    const parent = makeTempDir();
    const dir = join(parent, "nested", "data");
    expect(existsSync(dir)).toBe(false);
    const lock = acquirePgliteLock(dir);
    expect(existsSync(dir)).toBe(true);
    lock.release();
  });
});
