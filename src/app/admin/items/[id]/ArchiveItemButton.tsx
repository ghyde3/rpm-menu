"use client";

// Archive / Restore control for the item edit page — the reversible
// counterpart to DeleteItemButton's permanent delete. Archiving takes an item
// off the menu/screens/default admin list but keeps the record (restorable
// later); it never changes availability. Staff-or-owner (unlike delete, which
// is owner-only), matching the archive service gate.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { archiveItemAction, unarchiveItemAction } from "../actions";

export function ArchiveItemButton({ itemId, isArchived }: { itemId: string; isArchived: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const result = isArchived ? await unarchiveItemAction(itemId) : await archiveItemAction(itemId);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Restoring stays on the page (item is now active); archiving returns to
    // the list, where it no longer appears in the default Active view.
    if (isArchived) router.refresh();
    else router.push("/admin/items");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
      {error && (
        <span style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
          {error}
        </span>
      )}
      <Button variant={isArchived ? "primary" : "secondary"} onClick={handleClick} disabled={pending} type="button">
        {pending ? (isArchived ? "Restoring…" : "Archiving…") : isArchived ? "Restore Item" : "Archive Item"}
      </Button>
    </div>
  );
}
