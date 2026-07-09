"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { deleteItemAction } from "../actions";

export function DeleteItemButton({ itemId, itemName }: { itemId: string; itemName: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Delete "${itemName}"? This can't be undone from the UI (ask an owner to revert from Audit Log).`)) return;
    setPending(true);
    setError(null);
    const result = await deleteItemAction(itemId);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/items");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--sp-2)" }}>
      {error && (
        <span style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>{error}</span>
      )}
      <Button variant="danger" onClick={handleDelete} disabled={pending}>
        {pending ? "Deleting…" : "Delete Item"}
      </Button>
    </div>
  );
}
