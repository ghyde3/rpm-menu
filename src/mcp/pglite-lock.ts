// PGlite single-writer guard for the MCP server process (spec: "with PGlite
// it must refuse to start if another process holds the data dir -- detect
// and print a clear error").
//
// Why this file exists: `@electric-sql/pglite` (src/db/index.ts) provides no
// cross-process mutual exclusion of its own -- empirically verified while
// building this unit, two independent Node processes can `new PGlite(dir)`
// against the very same on-disk data directory at once with no error from
// either side (the "harmless TypeError noise" docs/architecture.md's
// "Known caveat" describes is a symptom of exactly this). The data
// directory's own `postmaster.pid` file is PGlite's fixed emulation of the
// real-Postgres lock-file format (`pid=-42`, a fake sentinel, not the real
// running process id) -- it is not usable as a liveness signal.
//
// So the MCP server manages its own advisory lock file, colocated in the
// same `PGLITE_DATA_DIR`, using an atomic O_EXCL create (`wx` flag) as the
// mutual-exclusion primitive plus a PID-liveness check to reclaim a stale
// lock left by a crashed process. This guards against two MCP server
// instances racing each other; it cannot see a concurrently running `next
// dev`/`db:migrate` process, since those entry points are outside this
// unit's owns_paths and don't participate in this lock convention -- the
// error message says so explicitly rather than overclaiming what was
// detected.
import { existsSync, mkdirSync, openSync, closeSync, writeSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const LOCK_FILE_NAME = ".mcp-server.lock";

export class PgliteLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PgliteLockError";
  }
}

interface LockFileContents {
  pid: number;
  startedAt: string;
}

function lockPath(dataDir: string): string {
  return join(dataDir, LOCK_FILE_NAME);
}

/** True if a process with this pid is currently alive (best-effort: a
 * `kill(pid, 0)` that throws ESRCH means it's gone; EPERM means it exists but
 * we don't own it -- still "alive" for our purposes). */
function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false;
    // EPERM (exists, different owner) or anything else unexpected: treat as
    // alive rather than risk clobbering someone else's lock.
    return true;
  }
}

function readLockFile(path: string): LockFileContents | null {
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<LockFileContents>;
    if (typeof parsed.pid !== "number") return null;
    return { pid: parsed.pid, startedAt: parsed.startedAt ?? "unknown" };
  } catch {
    return null;
  }
}

export interface AcquiredPgliteLock {
  /** Removes the lock file. Safe to call more than once. */
  release: () => void;
}

/**
 * Acquires the MCP server's advisory lock on `dataDir`, reclaiming a stale
 * lock (owning pid no longer alive) automatically. Throws `PgliteLockError`
 * with a clear, actionable message if a live process already holds it.
 */
export function acquirePgliteLock(dataDir: string): AcquiredPgliteLock {
  mkdirSync(dataDir, { recursive: true });
  const path = lockPath(dataDir);

  if (existsSync(path)) {
    const existing = readLockFile(path);
    if (existing && isPidAlive(existing.pid)) {
      throw new PgliteLockError(
        `PGlite data directory "${dataDir}" is already in use by another process ` +
          `(pid ${existing.pid}, started ${existing.startedAt}). PGlite is single-writer -- ` +
          `only one process may hold it at a time. Stop that process (it may be this same ` +
          `MCP server already running, or a leftover from a previous run) before starting ` +
          `again, or point this server at a real Postgres instance instead ` +
          `(set DATABASE_URL) so multiple processes can connect concurrently. ` +
          `Note: this lock is only enforced between MCP server instances -- it cannot detect ` +
          `a concurrently running "npm run dev" or db:migrate/db:seed process against the ` +
          `same PGLITE_DATA_DIR; per docs/architecture.md, never run those against a data dir ` +
          `an MCP server is using, and vice versa.`,
      );
    }
    // Stale lock (owning pid is gone) -- safe to reclaim.
    try {
      unlinkSync(path);
    } catch {
      // Ignore races on cleanup; the exclusive create below is the real gate.
    }
  }

  let fd: number;
  try {
    fd = openSync(path, "wx");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      // Lost a race with another process acquiring the lock between our
      // existsSync check and this create -- surface the same clear error.
      const existing = readLockFile(path);
      throw new PgliteLockError(
        `PGlite data directory "${dataDir}" was just claimed by another process` +
          (existing ? ` (pid ${existing.pid})` : "") +
          `. Try again once that process has exited.`,
      );
    }
    throw err;
  }

  const contents: LockFileContents = { pid: process.pid, startedAt: new Date().toISOString() };
  writeSync(fd, JSON.stringify(contents));
  closeSync(fd);

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      const current = readLockFile(path);
      // Only remove the lock file if it's still ours -- avoids clobbering a
      // newer lock in the unlikely event our own cleanup runs late.
      if (current && current.pid === process.pid) {
        unlinkSync(path);
      }
    } catch {
      // Best-effort cleanup; nothing more we can do on exit.
    }
  };

  return { release };
}
