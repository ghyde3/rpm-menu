// Category detail/edit — name, type, tagline, sort order, and the
// display_config editor (attribute order + per-surface description +
// badges — PRD §3.1 "Item Display Schema").
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCategory } from "@/lib/service/categories";
import { NotFoundError } from "@/lib/service/base/errors";
import { db } from "@/db";
import { Button } from "@/components/ds";
import { CategoryEditor } from "./CategoryEditor";

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await getCategory(db, id).catch((err) => {
    if (err instanceof NotFoundError) return null;
    throw err;
  });
  if (!category) notFound();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            color: "var(--accent-primary)",
            fontSize: "var(--fs-h3)",
            margin: 0,
          }}
        >
          {category.name}
        </h1>
        <Link href="/admin/categories">
          <Button variant="ghost" size="sm">
            ← Categories
          </Button>
        </Link>
      </div>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <CategoryEditor category={category} />
      </div>
    </div>
  );
}
