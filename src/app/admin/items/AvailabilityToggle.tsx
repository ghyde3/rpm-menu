"use client";

// The one-tap 86 toggle (PRD §3.1: "prominent in UI and optimized for
// mobile... must never be more than two taps"). Optimistic: flips
// immediately, calls the server action, and rolls back with a visible error
// if the write fails (e.g. a revoked/deactivated session).
import * as React from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ds";
import { setItemAvailabilityAction } from "./actions";

export interface AvailabilityToggleProps {
  itemId: string;
  initialAvailable: boolean;
}

export function AvailabilityToggle({ itemId, initialAvailable }: AvailabilityToggleProps) {
  const router = useRouter();
  const [available, setAvailable] = React.useState(initialAvailable);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Re-sync local state when the server re-renders this row with a new
  // prop (e.g. after router.refresh()) — set during render, not in an
  // effect, per the react-hooks/set-state-in-effect rule.
  const [prevInitialAvailable, setPrevInitialAvailable] = React.useState(initialAvailable);
  if (initialAvailable !== prevInitialAvailable) {
    setPrevInitialAvailable(initialAvailable);
    setAvailable(initialAvailable);
  }

  async function handleChange(next: boolean) {
    setError(null);
    setAvailable(next);
    setPending(true);
    const result = await setItemAvailabilityAction(itemId, next);
    setPending(false);
    if (!result.ok) {
      setAvailable(!next);
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <Switch checked={available} onChange={handleChange} disabled={pending} label={available ? "On" : "86'd"} />
      {error && (
        <span style={{ color: "var(--accent-primary)", fontSize: "0.6875rem", fontFamily: "var(--font-body)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
