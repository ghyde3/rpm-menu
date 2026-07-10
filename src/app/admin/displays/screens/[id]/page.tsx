// Screen detail/edit: core fields + display options (ScreenForm), the
// source editor matching `sourceMode` (query tags/categories vs. manual
// curated list), a background image picker, the live 16:9 preview rendered
// through the exact same template code the TV uses (§3.2), and delete.
import { notFound } from "next/navigation";
import Link from "next/link";
import { getScreen, listScreenItems } from "@/lib/service/screens";
import { listCategories } from "@/lib/service/categories";
import { listTags } from "@/lib/service/tags";
import { listItems } from "@/lib/service/items";
import { listImages } from "@/lib/service/images";
import { resolveScreenContent } from "@/lib/screens/resolve";
import { NotFoundError } from "@/lib/service/base/errors";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { Button, Card } from "@/components/ds";
import { ScreenForm } from "../ScreenForm";
import { SourceConfigEditor } from "./SourceConfigEditor";
import { ManualItemsEditor } from "./ManualItemsEditor";
import { BackgroundImagePicker } from "./BackgroundImagePicker";
import { DeleteScreenButton } from "./DeleteScreenButton";
import { ScreenPreview16x9 } from "@/components/screens/ScreenPreview16x9";

const sectionHeaderStyle = {
  fontFamily: "var(--font-heading)",
  fontSize: "0.875rem",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "var(--ls-caps)",
  color: "var(--text-muted)",
  marginBottom: "var(--sp-3)",
};

export default async function ScreenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentSession();
  const isOwner = session?.user.role === "owner";

  const screen = await getScreen(db, id).catch((err) => {
    if (err instanceof NotFoundError) return null;
    throw err;
  });
  if (!screen) notFound();

  const [categories, tags, items, images, screenItemRows, resolved] = await Promise.all([
    listCategories(db),
    listTags(db),
    listItems(db),
    listImages(db),
    listScreenItems(db, id),
    resolveScreenContent(db, id),
  ]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--sp-3)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            color: "var(--accent-primary)",
            fontSize: "var(--fs-h3)",
            margin: 0,
          }}
        >
          {screen.name}
        </h1>
        <Link href="/admin/displays/screens">
          <Button variant="ghost" size="sm">
            ← Screens
          </Button>
        </Link>
      </div>

      <div style={{ marginTop: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
        <Card>
          <h2 style={sectionHeaderStyle}>Live Preview</h2>
          <ScreenPreview16x9 resolved={resolved} />
        </Card>

        {isOwner ? (
          <>
            <ScreenForm screen={screen} />

            {screen.sourceMode === "query" ? (
              <SourceConfigEditor screen={screen} categories={categories} tags={tags} />
            ) : (
              <ManualItemsEditor
                screenId={screen.id}
                allItems={items}
                initialItemIds={screenItemRows.map((r) => r.itemId)}
              />
            )}

            <BackgroundImagePicker screenId={screen.id} currentImageId={screen.backgroundImageKey} images={images} />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <DeleteScreenButton screenId={screen.id} screenName={screen.name} />
            </div>
          </>
        ) : (
          <Card>
            <p style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)", margin: 0 }}>
              Screens are managed by the owner (PRD §2).
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
