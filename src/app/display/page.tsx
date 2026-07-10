"use client";

// /display — unpaired TV pairing-code screen (§3.3, §5.2). "TV navigates to
// /display -> shows a 6-character pairing code -> owner enters code in admin
// UI and assigns a screen -> TV receives a long-lived, revocable, read-only
// display token (localStorage) and starts rendering."
import * as React from "react";
import { useRouter } from "next/navigation";
import { loadDisplayAuth, saveDisplayAuth } from "./storage";

interface PairingCodeResponse {
  code: string;
  expiresAt: string;
}

type PollResponse =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "not_found" }
  | { status: "paired"; token: string; displayId: string }
  | { status: "already_issued"; displayId: string };

const POLL_INTERVAL_MS = 3000;

export default function DisplayPairingPage() {
  const router = useRouter();
  const [code, setCode] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Already paired (token survived a reload / power cycle) — skip
    // straight to the render route rather than showing a pointless code.
    if (loadDisplayAuth()) {
      router.replace("/display/render");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let activeCode: string | null = null;

    // Named function declarations (hoisted) rather than useCallback +
    // refs — `requestNewCode` and `poll` can call each other by name with
    // no self-referential-closure/TDZ issue, and both stay scoped to this
    // one effect for the lifetime of the pairing screen.
    async function requestNewCode() {
      try {
        setError(null);
        const res = await fetch("/api/display/pairing-code", { method: "POST" });
        if (!res.ok) throw new Error(`Failed to request a pairing code (${res.status})`);
        const body = (await res.json()) as PairingCodeResponse;
        if (cancelled) return;
        activeCode = body.code;
        setCode(body.code);
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        setError("Couldn't reach the server. Retrying…");
        timer = setTimeout(requestNewCode, POLL_INTERVAL_MS);
      }
    }

    async function poll() {
      if (!activeCode) return;
      try {
        const res = await fetch(`/api/display/pairing-code/${activeCode}`);
        const body = (await res.json()) as PollResponse;
        if (cancelled) return;

        if (body.status === "paired") {
          saveDisplayAuth({ displayId: body.displayId, token: body.token });
          router.replace("/display/render");
          return;
        }
        if (body.status === "expired" || body.status === "not_found") {
          await requestNewCode();
          return;
        }
        // "pending" or "already_issued" (the latter only in a rare race) —
        // keep waiting on the same code.
      } catch {
        // Transient network error — just try again on the next tick.
      }
      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    requestNewCode();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--sp-6)",
        background: "var(--surface-base, #101114)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-body)",
        padding: "var(--sp-6)",
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-heading)",
          textTransform: "uppercase",
          letterSpacing: "var(--ls-caps)",
          color: "var(--text-muted)",
          fontSize: "1.25rem",
        }}
      >
        Pair This Display
      </span>

      {code ? (
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(4rem, 14vw, 9rem)",
            letterSpacing: "0.15em",
            color: "var(--accent-primary)",
            lineHeight: 1,
          }}
          aria-live="polite"
        >
          {code}
        </div>
      ) : (
        <div style={{ fontSize: "1.5rem", color: "var(--text-faint)" }}>Requesting a code…</div>
      )}

      <p style={{ fontSize: "1.125rem", color: "var(--text-secondary)", maxWidth: 560 }}>
        In the admin dashboard, go to <strong>Settings &rsaquo; Displays</strong> and enter this code to finish
        pairing.
      </p>

      {error && <p style={{ color: "var(--accent-primary)", fontSize: "0.9375rem" }}>{error}</p>}
    </div>
  );
}
