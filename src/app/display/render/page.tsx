"use client";

// /display/render — the paired TV's runtime page (§3.3, §5.2): polls
// /api/display/poll every 15-30s with an ETag-based version check,
// re-rendering only on change, and implements every resilience requirement
// from §3.3:
//   - wifi drop -> keep last-known content, retry with backoff, subtle
//     offline indicator ("visible up close, invisible from across the bar")
//   - power loss -> token in localStorage -> resumes with no human
//     involvement (handled by ./page.tsx + ./storage.ts already)
//   - nightly reload at 4am to clear memory leaks in cheap TV browsers
import * as React from "react";
import { useRouter } from "next/navigation";
import { ScreenRenderer } from "@/components/screens/ScreenRenderer";
import type { ResolvedScreen } from "@/lib/screens/resolve";
import { loadDisplayAuth, clearDisplayAuth, saveLastResolved, loadLastResolved } from "../storage";

interface PollBody {
  screenId: string | null;
  version: number;
  matchedRuleId: string | null;
  resolved: ResolvedScreen | null;
}

const BASE_POLL_MS = 20_000; // within §3.3's 15-30s window
const MAX_BACKOFF_MS = 120_000;
/** Consecutive failed polls before the subtle offline dot appears — avoids
 * flicker on one blip. */
const OFFLINE_AFTER_FAILURES = 2;

function msUntilNext4am(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(4, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export default function DisplayRenderPage() {
  const router = useRouter();
  const [resolved, setResolved] = React.useState<ResolvedScreen | null>(() => loadLastResolved<ResolvedScreen>());
  const [noScreenAssigned, setNoScreenAssigned] = React.useState(false);
  const [offline, setOffline] = React.useState(false);
  const etagRef = React.useRef<string | null>(null);
  const failCountRef = React.useRef(0);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = React.useRef(true);

  // No token at all -> straight back to the pairing screen.
  React.useEffect(() => {
    if (!loadDisplayAuth()) {
      router.replace("/display");
    }
  }, [router]);

  // Nightly reload (§3.3) — device-local clock. In practice the TV's system
  // clock matches venue-local time (it's a stationary device physically in
  // the venue), so this needs no server round trip / timezone lookup.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      window.location.reload();
    }, msUntilNext4am());
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  React.useEffect(() => {
    async function poll() {
      const auth = loadDisplayAuth();
      if (!auth) {
        router.replace("/display");
        return;
      }

      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${auth.token}` };
        if (etagRef.current) headers["If-None-Match"] = etagRef.current;

        const res = await fetch(`/api/display/poll?displayId=${encodeURIComponent(auth.displayId)}`, { headers });

        if (res.status === 401) {
          // Revoked or otherwise invalid — blank to the re-pair screen
          // (§3.8: "Revoking a token blanks that TV to a re-pair screen on
          // its next poll").
          clearDisplayAuth();
          router.replace("/display");
          return;
        }

        if (res.status === 304) {
          failCountRef.current = 0;
          if (mountedRef.current) setOffline(false);
          scheduleNext(BASE_POLL_MS);
          return;
        }

        if (!res.ok) throw new Error(`poll failed (${res.status})`);

        const body = (await res.json()) as PollBody;
        failCountRef.current = 0;
        if (!mountedRef.current) return;

        setOffline(false);
        etagRef.current = res.headers.get("etag");

        if (!body.resolved) {
          setNoScreenAssigned(true);
          setResolved(null);
        } else {
          setNoScreenAssigned(false);
          setResolved(body.resolved);
          saveLastResolved(body.resolved);
        }

        scheduleNext(BASE_POLL_MS);
      } catch {
        failCountRef.current += 1;
        if (mountedRef.current && failCountRef.current >= OFFLINE_AFTER_FAILURES) {
          setOffline(true);
        }
        const backoff = Math.min(BASE_POLL_MS * 2 ** failCountRef.current, MAX_BACKOFF_MS);
        scheduleNext(backoff);
      }
    }

    function scheduleNext(delay: number) {
      if (!mountedRef.current) return;
      timerRef.current = setTimeout(poll, delay);
    }

    poll();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {resolved ? (
        <ScreenRenderer resolved={resolved} />
      ) : noScreenAssigned ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--surface-base, #101114)",
            color: "var(--text-faint)",
            fontFamily: "var(--font-body)",
            fontSize: "1.5rem",
          }}
        >
          Paired — waiting for a screen to be assigned in Settings &rsaquo; Displays.
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "var(--surface-base, #101114)",
          }}
        />
      )}

      {/* Subtle offline indicator (§3.3: "visible up close, invisible from
          across the bar") — a small dim dot, bottom-left, only while
          rendering last-known content through a connectivity gap. */}
      {offline && (
        <div
          title="Offline — showing last-known content"
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent-primary)",
            opacity: 0.55,
          }}
        />
      )}
    </div>
  );
}
