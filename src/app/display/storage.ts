// Shared localStorage helpers for the TV pairing + render pages (§3.3: "TV
// receives a long-lived, revocable, read-only display token (localStorage)
// and starts rendering"). Plain module, no "use client" directive needed —
// safe to import from either client component since it has no JSX.
const DISPLAY_ID_KEY = "rpm.display.id";
const DISPLAY_TOKEN_KEY = "rpm.display.token";

export interface StoredDisplayAuth {
  displayId: string;
  token: string;
}

export function loadDisplayAuth(): StoredDisplayAuth | null {
  if (typeof window === "undefined") return null;
  const displayId = window.localStorage.getItem(DISPLAY_ID_KEY);
  const token = window.localStorage.getItem(DISPLAY_TOKEN_KEY);
  if (!displayId || !token) return null;
  return { displayId, token };
}

export function saveDisplayAuth(auth: StoredDisplayAuth): void {
  window.localStorage.setItem(DISPLAY_ID_KEY, auth.displayId);
  window.localStorage.setItem(DISPLAY_TOKEN_KEY, auth.token);
}

export function clearDisplayAuth(): void {
  window.localStorage.removeItem(DISPLAY_ID_KEY);
  window.localStorage.removeItem(DISPLAY_TOKEN_KEY);
  window.localStorage.removeItem(LAST_RESOLVED_KEY);
}

const LAST_RESOLVED_KEY = "rpm.display.lastResolved";

/** Best-effort "last-known content" cache (§3.3 resilience: "keep rendering
 * last-known content" through a wifi drop or a cold boot after power loss —
 * caching across a reload means the TV has *something* to paint the instant
 * it comes back up, before the first poll even completes). Never load-
 * bearing for correctness — every write/read is wrapped so a full/disabled
 * localStorage (private browsing, cheap TV browser quirks) degrades to "no
 * cache" rather than throwing. */
export function saveLastResolved(payload: unknown): void {
  try {
    window.localStorage.setItem(LAST_RESOLVED_KEY, JSON.stringify(payload));
  } catch {
    // best-effort only
  }
}

export function loadLastResolved<T>(): T | null {
  try {
    const raw = window.localStorage.getItem(LAST_RESOLVED_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
