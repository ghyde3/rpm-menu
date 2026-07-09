import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { Button, Card } from "@/components/ds";
import { getModifierGroupDetail } from "@/lib/service/modifiers";
import { NotFoundError } from "@/lib/service/base/errors";
import { listCategories } from "@/lib/service/categories";
import { listItems } from "@/lib/service/items";
import { GroupEditForm } from "./GroupEditForm";
import { OptionsEditor } from "./OptionsEditor";
import { AttachmentsEditor } from "./AttachmentsEditor";

const sectionHeading: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "0.875rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  color: "var(--text-muted)",
  marginBottom: "var(--sp-3)",
};

export default async function ModifierGroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

  const detail = await getModifierGroupDetail(db, groupId).catch((err) => {
    if (err instanceof NotFoundError) return null;
    throw err;
  });
  if (!detail) notFound();

  const [categories, items] = await Promise.all([listCategories(db), listItems(db)]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--sp-3)" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            color: "var(--accent-primary)",
            fontSize: "var(--fs-h3)",
            margin: 0,
          }}
        >
          {detail.group.name}
        </h1>
        <Link href="/admin/modifiers">
          <Button variant="ghost" size="sm">
            ← Modifiers
          </Button>
        </Link>
      </div>

      <GroupEditForm group={detail.group} />

      <Card>
        <h2 style={sectionHeading}>Options</h2>
        <OptionsEditor groupId={detail.group.id} options={detail.options} />
      </Card>

      <Card>
        <h2 style={sectionHeading}>Attached To</h2>
        <AttachmentsEditor
          groupId={detail.group.id}
          attachments={detail.attachments}
          categories={categories}
          items={items}
        />
      </Card>
    </div>
  );
}
