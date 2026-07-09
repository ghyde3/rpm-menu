"use client";

// Category-level attachment fan-out (addendum §1): "category-level group
// edits show 'applies to N items' with a one-item live preview before save,
// so fan-out is never silent." The preview is fetched live from the
// category's current membership as soon as one is selected, before the
// Attach button is ever pressed.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ds";
import type { Category, Item } from "@/db/schema";
import type { ModifierGroupAttachmentDetail } from "@/lib/service/modifiers";
import { createModifierGroupAttachmentAction, deleteModifierGroupAttachmentAction, previewCategoryAttachmentAction } from "../actions";

export interface AttachmentsEditorProps {
  groupId: string;
  attachments: ModifierGroupAttachmentDetail[];
  categories: Category[];
  items: Item[];
}

const selectStyle: React.CSSProperties = {
  height: 44,
  background: "var(--surface-inset)",
  border: "var(--bw) solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-body)",
  padding: "0 var(--sp-3)",
};

export function AttachmentsEditor({ groupId, attachments, categories, items }: AttachmentsEditorProps) {
  const router = useRouter();
  const [targetType, setTargetType] = React.useState<"item" | "category">("category");
  const [targetId, setTargetId] = React.useState("");
  const [preview, setPreview] = React.useState<{ count: number; sampleItems: { id: string; name: string }[] } | null>(null);
  const [pending, setPending] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const attachedItemIds = new Set(attachments.filter((a) => a.itemId).map((a) => a.itemId as string));
  const attachedCategoryIds = new Set(attachments.filter((a) => a.categoryId).map((a) => a.categoryId as string));

  const availableItems = items.filter((i) => !attachedItemIds.has(i.id));
  const availableCategories = categories.filter((c) => !attachedCategoryIds.has(c.id));

  function handleTargetTypeChange(next: "item" | "category") {
    setTargetType(next);
    setTargetId("");
    setPreview(null);
  }

  async function handleTargetChange(id: string) {
    setTargetId(id);
    setPreview(null);
    if (targetType === "category" && id) {
      const result = await previewCategoryAttachmentAction(id);
      if (result.ok) setPreview(result.data);
    }
  }

  async function handleAttach() {
    if (!targetId) return;
    setPending(true);
    setError(null);
    const result = await createModifierGroupAttachmentAction({
      groupId,
      itemId: targetType === "item" ? targetId : null,
      categoryId: targetType === "category" ? targetId : null,
      sortOrder: attachments.length,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTargetId("");
    setPreview(null);
    router.refresh();
  }

  async function handleRemove(attachment: ModifierGroupAttachmentDetail) {
    setRemovingId(attachment.id);
    setError(null);
    const result = await deleteModifierGroupAttachmentAction(attachment.id, groupId, attachment.itemId);
    setRemovingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      {error && (
        <p style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", margin: 0 }}>
          {error}
        </p>
      )}

      {attachments.length === 0 && (
        <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
          Not attached anywhere yet — attach to a single item, or a whole category to fan out to every item in it.
        </p>
      )}

      {attachments.map((attachment) => (
        <div key={attachment.id} style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <span style={{ flex: 1, fontFamily: "var(--font-body)", color: "var(--text-primary)" }}>
            {attachment.itemId ? (
              <>Item: {attachment.itemName ?? "(deleted item)"}</>
            ) : (
              <>Category: {attachment.categoryName ?? "(deleted category)"} — fans out to every item in it</>
            )}
          </span>
          <Button variant="danger" size="sm" disabled={removingId === attachment.id} onClick={() => handleRemove(attachment)}>
            {removingId === attachment.id ? "Removing…" : "Detach"}
          </Button>
        </div>
      ))}

      <Card padded={true} style={{ background: "var(--surface-inset)", boxShadow: "none" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              <label
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "var(--ls-caps)",
                  color: "var(--text-muted)",
                }}
              >
                Attach to
              </label>
              <select value={targetType} onChange={(e) => handleTargetTypeChange(e.target.value as "item" | "category")} style={selectStyle}>
                <option value="category">A whole category (fan-out)</option>
                <option value="item">A single item</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", minWidth: 220 }}>
              <label
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "var(--ls-caps)",
                  color: "var(--text-muted)",
                }}
              >
                {targetType === "category" ? "Category" : "Item"}
              </label>
              <select value={targetId} onChange={(e) => handleTargetChange(e.target.value)} style={selectStyle}>
                <option value="">Select…</option>
                {(targetType === "category" ? availableCategories : availableItems).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" disabled={!targetId || pending} onClick={handleAttach}>
              {pending ? "Attaching…" : "Attach"}
            </Button>
          </div>

          {targetType === "category" && targetId && preview && (
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.8125rem",
                color: "var(--text-secondary)",
                padding: "var(--sp-2) var(--sp-3)",
                background: "var(--surface-raised)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              Applies to <strong>{preview.count}</strong> item{preview.count === 1 ? "" : "s"}
              {preview.sampleItems.length > 0 && (
                <>
                  {" "}
                  — e.g. <em>{preview.sampleItems[0].name}</em>
                  {preview.count > 1 ? ` and ${preview.count - 1} more` : ""}
                </>
              )}
              .
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
