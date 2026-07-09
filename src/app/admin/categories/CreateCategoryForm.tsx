"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ds";
import { createCategoryAction } from "./actions";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  color: "var(--text-muted)",
};

export function CreateCategoryForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<"food" | "drink">("food");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    const result = await createCategoryAction({ name: name.trim(), type });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    router.push(`/admin/categories/${result.data.id}`);
  }

  return (
    <Card accent>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)", alignItems: "flex-end" }}>
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Draft Beer"
          style={{ minWidth: 200 }}
          required
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          <label style={labelStyle}>Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "food" | "drink")}
            style={{
              height: 44,
              background: "var(--surface-inset)",
              border: "var(--bw) solid var(--border-strong)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
              padding: "0 var(--sp-3)",
            }}
          >
            <option value="food">Food</option>
            <option value="drink">Drink</option>
          </select>
        </div>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Adding…" : "Add Category"}
        </Button>
        {error && (
          <p style={{ color: "var(--accent-primary)", margin: 0, fontFamily: "var(--font-body)", flexBasis: "100%" }}>
            {error}
          </p>
        )}
      </form>
    </Card>
  );
}
