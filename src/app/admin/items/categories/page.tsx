// Categories admin (PRD §3.1 "Categories"): CRUD, typed food|drink, ordered.
// Each category's display_config (attribute order / description / badges —
// §3.1 "Item Display Schema") is edited on its detail page since it's a
// meaningfully bigger form than fits a list row.
import Link from "next/link";
import { listCategories } from "@/lib/service/categories";
import { db } from "@/db";
import { Card } from "@/components/ds";
import { HubTabs, ITEMS_HUB_TABS } from "@/components/nav/HubTabs";
import { CreateCategoryForm } from "./CreateCategoryForm";

export default async function CategoriesPage() {
  const categories = await listCategories(db);
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return (
    <div>
      <HubTabs tabs={ITEMS_HUB_TABS} />
      <h1
        style={{
          fontFamily: "var(--font-display)",
          textTransform: "uppercase",
          color: "var(--accent-primary)",
          fontSize: "var(--fs-h3)",
          margin: 0,
        }}
      >
        Categories
      </h1>

      <div style={{ marginTop: "var(--sp-5)" }}>
        <CreateCategoryForm />
      </div>

      <div style={{ marginTop: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        {sorted.length === 0 && (
          <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-body)" }}>
            No categories yet — add one above before creating items.
          </p>
        )}
        {sorted.map((category) => (
          <Link key={category.id} href={`/admin/items/categories/${category.id}`} style={{ textDecoration: "none" }}>
            <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-4)" }}>
              <div>
                <div style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", fontWeight: 600 }}>
                  {category.name}
                  {category.tagline && (
                    <span style={{ color: "var(--accent-price)", marginLeft: "var(--sp-3)", fontSize: "0.8125rem" }}>
                      {category.tagline}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--text-faint)" }}>
                  {category.type} · sort {category.sortOrder}
                </div>
              </div>
              <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-heading)", fontSize: "0.8125rem" }}>
                Edit →
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
